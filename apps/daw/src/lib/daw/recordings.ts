import { analyzeBeat, type BeatAnalysis } from "@audio-ui/engine/analysis";
import type { RecordingSource } from "@/lib/clip-player";
import { decodeAudioChannels } from "@/lib/daw/audio-files";
import { type Measured, measureSound } from "@/lib/daw/measure";

const EXTENSION = /\.[^.]+$/;

/** A recording's shape, a slice at a time. */
export interface RecordingPeaks {
  max: Float32Array;
  min: Float32Array;
}

/** A recording of the project: its sound, decoded at the engine's rate, and what its clips draw. */
export interface Recording {
  /** Its beat as it was read when it came in, which warps the clips laid down from it (CLP-019). */
  beat?: BeatAnalysis;
  /** How much of its sound lies in each pitch class, C to B, summing to 1: what a key is read from (MID-010). */
  chroma?: readonly number[];
  /** How long it lasts, in seconds. */
  length: number;
  /** The name of the file it came from, without its extension. */
  name: string;
  /** The lowest and highest sample of each slice, from -1 to 1. */
  peaks: RecordingPeaks;
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
 * channel, its beat and its chroma. `null` when the bytes are not sound the browser can
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
  return {
    ...recordingOf(channels, context.sampleRate, name),
    beat: analyzeBeat(channels, context.sampleRate),
  };
}

/** A recording of channels held in memory, at `sampleRate`, with the peaks of its loudest channel and its chroma: `measured` when they were read already. */
export function recordingOf(
  channels: Float32Array[],
  sampleRate: number,
  name: string,
  measured: Measured = measureSound(channels, sampleRate)
): Recording {
  return {
    ...measured,
    length: (channels[0]?.length ?? 0) / sampleRate,
    name,
    source: { channels, sampleRate },
  };
}

const stretches = new WeakMap<RecordingPeaks, Map<number, RecordingPeaks>>();

/** The peaks of the stretch of its recording a clip's source holds: what its waveform is drawn from. */
export function sourcePeaks(
  clip: { sourceFrom?: number; sourceLength: number },
  recording: Recording
): RecordingPeaks {
  const { length, peaks } = recording;
  const count = peaks.max.length;
  const from = Math.floor(((clip.sourceFrom ?? 0) / length) * count);
  const to = Math.max(
    from + 1,
    Math.ceil((((clip.sourceFrom ?? 0) + clip.sourceLength) / length) * count)
  );
  // The same view of them each time, copying nothing: a clip draws again only when it changes.
  const views = stretches.get(peaks) ?? new Map<number, RecordingPeaks>();
  stretches.set(peaks, views);
  const key = from * (count + 1) + to;
  const stretch = views.get(key) ?? {
    max: peaks.max.subarray(from, to),
    min: peaks.min.subarray(from, to),
  };
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
