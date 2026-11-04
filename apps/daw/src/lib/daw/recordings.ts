import { computePeaks, normalizePeaks } from "@audio-ui/core/analysis";
import { decodeAudioChannels } from "@/lib/audio-decode";
import type { RecordingSource } from "@/lib/clip-player";

/** How many peaks a recording keeps for its waveform: enough to zoom far in. */
const PEAKS = 16_384;
const EXTENSION = /\.[^.]+$/;

/** A recording of the project: its sound, decoded at the engine's rate, and what its clips draw. */
export interface Recording {
  /** How long it lasts, in seconds. */
  length: number;
  /** The name of the file it came from, without its extension. */
  name: string;
  /** One amplitude per slice, from 0 to 1. */
  peaks: number[];
  source: RecordingSource;
}

/** A file's name as a clip or a track takes it: without its extension. */
export const nameOf = (file: { name: string }) =>
  file.name.replace(EXTENSION, "");

/**
 * A new recording id: random, so an id is never given to other bytes, not
 * even after another project was opened in the same page, whose players and
 * cache still know the ids they played.
 */
export function freshRecordingId(taken: ReadonlySet<string>): string {
  let id = `rec-${crypto.randomUUID().slice(0, 8)}`;
  while (taken.has(id)) {
    id = `rec-${crypto.randomUUID().slice(0, 8)}`;
  }
  return id;
}

/**
 * Decodes a file's bytes on `context`, at its sample rate (CLP-011: a file at
 * another rate is converted on the way), with the peaks of its loudest
 * channel. `null` when the bytes are not sound the browser can decode.
 */
export async function decodeRecording(
  context: BaseAudioContext,
  bytes: ArrayBuffer,
  name: string
): Promise<Recording | null> {
  const channels = await decodeAudioChannels(context, bytes).catch(() => null);
  const [first] = channels ?? [];
  if (!(channels && first && first.length > 0)) {
    return null;
  }
  const { max, min } = normalizePeaks(computePeaks(channels, PEAKS));
  return {
    length: first.length / context.sampleRate,
    name,
    peaks: Array.from(max, (high, index) => Math.max(high, -(min[index] ?? 0))),
    source: { channels, sampleRate: context.sampleRate },
  };
}

/** The peaks of the stretch of its recording a clip's source holds: what its waveform is drawn from. */
export function sourcePeaks(
  clip: { sourceFrom?: number; sourceLength: number },
  recording: Recording
): number[] {
  const { length, peaks } = recording;
  const from = Math.floor(((clip.sourceFrom ?? 0) / length) * peaks.length);
  const to = Math.ceil(
    (((clip.sourceFrom ?? 0) + clip.sourceLength) / length) * peaks.length
  );
  return peaks.slice(from, Math.max(from + 1, to));
}

/** The first id `midi-<n>` no clip of the project has. */
export function freshMidiClipId(taken: ReadonlySet<string>): string {
  let n = 1;
  while (taken.has(`midi-${n}`)) {
    n += 1;
  }
  return `midi-${n}`;
}
