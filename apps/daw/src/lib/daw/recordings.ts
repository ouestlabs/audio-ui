import { computePeaks, normalizePeaks } from "@audio-ui/core/analysis";
import { analyzeBeat, type BeatAnalysis } from "@/lib/arrangement";
import { decodeAudioChannels } from "@/lib/audio-decode";
import type { RecordingSource } from "@/lib/clip-player";

/** How many peaks a recording keeps per second: one per pixel at the closest zoom. */
const PEAKS_PER_SECOND = 256;
const LEAST_PEAKS = 4096;
/** What the longest recordings stop at: a little over an hour at that rate. */
const MOST_PEAKS = 2 ** 20;
const EXTENSION = /\.[^.]+$/;

/** A recording of the project: its sound, decoded at the engine's rate, and what its clips draw. */
export interface Recording {
  /** Its beat as it was read when it came in, which warps the clips laid down from it (CLP-019). */
  beat?: BeatAnalysis;
  /** How long it lasts, in seconds. */
  length: number;
  /** The name of the file it came from, without its extension. */
  name: string;
  /** One amplitude per slice, from 0 to 1. */
  peaks: Float32Array;
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

/** How many peaks a recording of so many seconds keeps. */
export const peakCountFor = (seconds: number) =>
  Math.min(
    MOST_PEAKS,
    Math.max(LEAST_PEAKS, Math.ceil(seconds * PEAKS_PER_SECOND))
  );

/**
 * Decodes a file's bytes on `context`, at its sample rate (CLP-011: a file at
 * another rate is converted on the way), with the peaks of its loudest
 * channel and its beat. `null` when the bytes are not sound the browser can
 * decode.
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
  const { max, min } = normalizePeaks(
    computePeaks(channels, peakCountFor(first.length / context.sampleRate))
  );
  return {
    beat: analyzeBeat(channels, context.sampleRate),
    length: first.length / context.sampleRate,
    name,
    peaks: Float32Array.from(max, (high, index) =>
      Math.max(high, -(min[index] ?? 0))
    ),
    source: { channels, sampleRate: context.sampleRate },
  };
}

const stretches = new WeakMap<Float32Array, Map<number, Float32Array>>();

/** The peaks of the stretch of its recording a clip's source holds: what its waveform is drawn from. */
export function sourcePeaks(
  clip: { sourceFrom?: number; sourceLength: number },
  recording: Recording
): Float32Array {
  const { length, peaks } = recording;
  const from = Math.floor(((clip.sourceFrom ?? 0) / length) * peaks.length);
  const to = Math.ceil(
    (((clip.sourceFrom ?? 0) + clip.sourceLength) / length) * peaks.length
  );
  // The same view of them each time, copying nothing: a clip draws again only when it changes.
  const views = stretches.get(peaks) ?? new Map<number, Float32Array>();
  stretches.set(peaks, views);
  const key = from * (peaks.length + 1) + to;
  const stretch =
    views.get(key) ?? peaks.subarray(from, Math.max(from + 1, to));
  views.set(key, stretch);
  return stretch;
}

/** The first id `midi-<n>` no clip of the project has. */
export function freshMidiClipId(taken: ReadonlySet<string>): string {
  let n = 1;
  while (taken.has(`midi-${n}`)) {
    n += 1;
  }
  return `midi-${n}`;
}
