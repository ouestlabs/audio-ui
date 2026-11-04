/**
 * What consolidating a stretch of time renders (ARR-020): each audio track's
 * clips as they play, without the track's chain, into one recording, kept and
 * streamed as a dropped file is, in floats so a clip's gain past full scale
 * stays in it. MIDI tracks render nothing: their notes merge in the document.
 */
import type { TimeSelection } from "@/lib/arrangement";
import { renderTrackClips } from "@/lib/arrangement-engine";
import { type ArrangementDoc, audioClipsIn } from "@/lib/arrangement-state";
import type { RecordingSource } from "@/lib/clip-player";
import { canStream, streamRecording } from "@/lib/daw/cache";
import { type Dropped, decodeFiles } from "@/lib/daw/drop";
import { encodeWav } from "@/lib/wav-file";

/**
 * The recordings a stretch consolidates into, one after the other: `made` by
 * their ids, and `rendered`, the id of each track's, for `consolidate-time`.
 */
export async function renderConsolidated(
  context: BaseAudioContext,
  doc: ArrangementDoc,
  time: TimeSelection,
  sources: ReadonlyMap<string, RecordingSource>,
  taken: ReadonlySet<string>
): Promise<{ made: Map<string, Dropped>; rendered: Record<string, string> }> {
  const ids = new Set(taken);
  const made = new Map<string, Dropped>();
  const rendered: Record<string, string> = {};
  await time.tracks.reduce(async (done, track) => {
    await done;
    const [first] = audioClipsIn(doc.clips, track, time.range);
    if (!first) {
      return;
    }
    const buffer = await renderTrackClips(doc, track, time.range, sources, {
      sampleRate: context.sampleRate,
    });
    if (!buffer) {
      throw new Error("this browser cannot render offline");
    }
    const bytes = encodeWav(
      [buffer.getChannelData(0), buffer.getChannelData(1)],
      buffer.sampleRate,
      { bitDepth: 32 }
    );
    const file = new File([bytes as BlobPart], `${first.name}.wav`, {
      type: "audio/wav",
    });
    const { made: decoded } = await decodeFiles(
      context,
      [file],
      ids,
      canStream() ? streamRecording : undefined
    );
    for (const [id, dropped] of decoded) {
      ids.add(id);
      made.set(id, dropped);
      rendered[track] = id;
    }
  }, Promise.resolve());
  return { made, rendered };
}
