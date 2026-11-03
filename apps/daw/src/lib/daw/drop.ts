import type { Arranged } from "@/lib/arrangement";
import type { ArrangementCommand } from "@/lib/arrangement-state";
import {
  decodeRecording,
  freshRecordingId,
  nameOf,
  type Recording,
} from "@/lib/daw/recordings";

/** Where a file dropped on the add-track row goes: a track of its own. */
export const NEW_TRACK = "new";

/** A dropped file, decoded: its recording and the bytes it came from, to keep. */
export interface Dropped {
  bytes: ArrayBuffer;
  recording: Recording;
}

/**
 * The files decoded at once, in the order they were dropped, each under the
 * next free recording id; the names of those that are not sound (ARR-007).
 */
export async function decodeFiles(
  context: BaseAudioContext,
  files: readonly File[],
  taken: ReadonlySet<string>
): Promise<{ made: Map<string, Dropped>; skipped: string[] }> {
  const decoded = await Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      return {
        bytes,
        file,
        recording: await decodeRecording(context, bytes, nameOf(file)),
      };
    })
  );
  const ids = new Set(taken);
  const made = new Map<string, Dropped>();
  const skipped: string[] = [];
  for (const { bytes, file, recording } of decoded) {
    if (recording) {
      const id = freshRecordingId(ids);
      ids.add(id);
      made.set(id, { bytes, recording });
    } else {
      skipped.push(file.name);
    }
  }
  return { made, skipped };
}

/**
 * What lays dropped recordings out, as one batch: on a track, one clip after
 * the other from `at` (ARR-005); on the add-track row, a track each, named
 * after its file, its clip at `at` (ARR-006). The arrangement grows to hold
 * what goes past its end (TRN-008).
 */
export function dropCommands(
  recordings: ReadonlyMap<string, Recording>,
  track: string,
  at: number,
  duration: number
): ArrangementCommand[] {
  const commands: ArrangementCommand[] = [];
  let start = at;
  let end = duration;
  for (const [id, recording] of recordings) {
    const onto = track === NEW_TRACK ? `track-${id}` : track;
    if (track === NEW_TRACK) {
      commands.push({
        id: onto,
        kind: "audio",
        name: recording.name,
        type: "add-track",
      });
    }
    const clip: Arranged = {
      id,
      name: recording.name,
      recording: id,
      sourceLength: recording.length,
      track: onto,
      value: {
        fadeIn: 0,
        fadeOut: 0,
        length: recording.length,
        offset: 0,
        start,
      },
    };
    end = Math.max(end, start + recording.length);
    commands.push({ clip, type: "add-clip" });
    if (track !== NEW_TRACK) {
      start += recording.length;
    }
  }
  return end > duration
    ? [{ duration: end, type: "set-duration" }, ...commands]
    : commands;
}
