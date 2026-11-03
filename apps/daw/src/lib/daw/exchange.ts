/**
 * Projects to and from other DAWs, through DAWproject (PRJ-008): an export
 * packs the arrangement and the files of the recordings its clips play, an
 * import opens one in place of the project, its recordings kept and cached as
 * dropped files are, and each MIDI track with no instrument given the one a
 * new MIDI track gets.
 */
import type { ArrangementDoc } from "@/lib/arrangement-state";
import { canStream, streamRecording } from "@/lib/daw/cache";
import { deviceAt } from "@/lib/daw/project";
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  sampleFileName,
  sniffExtension,
  withFreshIds,
} from "@/lib/daw/project-file";
import {
  decodeRecording,
  freshRecordingId,
  type Recording,
} from "@/lib/daw/recordings";
import { canStore, loadRecording, saveRecording } from "@/lib/daw/storage";
import {
  type DawprojectRecording,
  exportDawproject,
  importDawproject,
} from "@/lib/dawproject";

/** The file chooser takes these. */
export const DAWPROJECT_ACCEPT = ".dawproject";

const channelsOf = (recording: Recording) => {
  const { source } = recording;
  if ("getChannelData" in source) {
    return source.numberOfChannels;
  }
  return typeof source.channels === "number"
    ? source.channels
    : source.channels.length;
};

/** The project as a `.dawproject` file, and what it could not carry. */
export async function exportProject(
  doc: ArrangementDoc,
  recordings: ReadonlyMap<string, Recording>
): Promise<{ file: Blob; report: string[] }> {
  const played = new Set(doc.clips.map((clip) => clip.recording));
  const bytes = new Map<string, ArrayBuffer>();
  const described = new Map<string, DawprojectRecording>();
  const taken = new Set<string>();
  await [...recordings].reduce(async (done, [id, recording]) => {
    await done;
    const read = played.has(id) ? await loadRecording(id) : null;
    if (!read) {
      return;
    }
    const file = sampleFileName(recording.name, sniffExtension(read), taken);
    taken.add(file);
    bytes.set(id, read);
    described.set(id, {
      channels: channelsOf(recording),
      file,
      length: recording.length,
      sampleRate: recording.source.sampleRate,
    });
  }, Promise.resolve());
  return exportDawproject(doc, described, async (id) => bytes.get(id) ?? null);
}

/** A `.dawproject` file opened as a project: the arrangement, its recordings, and what was left out. */
export async function importProject(
  context: BaseAudioContext,
  blob: Blob,
  colors: number
): Promise<{
  doc: ArrangementDoc;
  recordings: Map<string, Recording>;
  report: string[];
}> {
  const imported = await importDawproject(blob, { colors });
  const taken = new Set<string>();
  // New ids, as a project opened from a folder gets, so they never meet those the page played.
  const fresh = withFreshIds(
    {
      doc: imported.doc,
      format: PROJECT_FORMAT,
      samples: imported.recordings.map(({ id, name }) => ({
        id,
        name,
        path: "",
      })),
      version: PROJECT_VERSION,
    },
    () => {
      const id = freshRecordingId(taken);
      taken.add(id);
      return id;
    }
  );
  const recordings = new Map<string, Recording>();
  const { report } = imported;
  await imported.recordings.reduce(async (done, recording, index) => {
    await done;
    const id = fresh.samples[index]?.id ?? recording.id;
    if (canStore()) {
      await saveRecording(id, recording.bytes);
    }
    const decoded = await decodeRecording(
      context,
      recording.bytes,
      recording.name
    );
    if (!decoded) {
      report.push(`${recording.name}: not a sound this browser can read`);
      return;
    }
    recordings.set(
      id,
      canStream() ? await streamRecording(id, decoded) : decoded
    );
  }, Promise.resolve());
  let made = 0;
  const doc: ArrangementDoc = {
    ...fresh.doc,
    tracks: fresh.doc.tracks.map((track) => {
      if (
        track.kind !== "midi" ||
        track.devices?.some((device) => device.instrument)
      ) {
        return track;
      }
      made += 1;
      return {
        ...track,
        devices: [
          deviceAt(`imported-synth-${made}`, "audioui.pocket-synth"),
          ...(track.devices ?? []),
        ],
      };
    }),
  };
  if (made > 0) {
    report.push(
      `${made} MIDI track${made > 1 ? "s" : ""} given the Pocket Synth, their instruments being left out`
    );
  }
  return { doc, recordings, report };
}
