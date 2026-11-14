/**
 * What the project reads of a recording's sound as it comes in, decoded from
 * a file or made by the Process menu: the peaks of its loudest channel and its
 * chroma. Nothing here touches the page, so a worker reads it too.
 */
import {
  audioChroma,
  computePeaks,
  normalizePeaks,
} from "@audio-ui/engine/analysis";
import { LEAF_FRAMES } from "@audio-ui/gl/waveform";
import type { RecordingPeaks } from "@/lib/daw/recordings";

/** How many peaks a recording keeps per second: one per pixel at the closest zoom. */
const PEAKS_PER_SECOND = 256;
const LEAST_PEAKS = 4096;
/** What the longest recordings stop at: a little over an hour at that rate. */
const MOST_PEAKS = 2 ** 20;

/** How many peaks a recording of so many seconds keeps. */
export const peakCountFor = (seconds: number) =>
  Math.min(
    MOST_PEAKS,
    Math.max(LEAST_PEAKS, Math.ceil(seconds * PEAKS_PER_SECOND))
  );

/** A sound's peaks and how much of it lies in each pitch class, C to B. */
export interface Measured {
  chroma: number[];
  peaks: RecordingPeaks;
}

/** The peaks of `channels`' loudest channel, at `sampleRate`: as many as a recording that long keeps. */
export function measurePeaks(
  channels: readonly Float32Array[],
  sampleRate: number
): RecordingPeaks {
  const length = (channels[0]?.length ?? 0) / sampleRate;
  const peaks = normalizePeaks(
    computePeaks([...channels], peakCountFor(length))
  );
  return {
    max: Float32Array.from(peaks.max),
    min: Float32Array.from(peaks.min),
  };
}

/**
 * The peaks `measurePeaks` reads from a recording's samples, read from its
 * leaves instead (`makeLeaves`: its mix's, then each channel's for one of
 * several), to a leaf: what an edit spliced into the cache gives without
 * reading the recording through.
 */
export function leavesPeaks(
  leaves: Float32Array,
  channels: number,
  length: number,
  sampleRate: number
): RecordingPeaks {
  const size = Math.ceil(length / LEAF_FRAMES) * 4;
  const sets =
    channels > 1
      ? Array.from({ length: channels }, (_, index) => index + 1)
      : [0];
  const count = length > 0 ? peakCountFor(length / sampleRate) : 0;
  const min = new Float32Array(count);
  const max = new Float32Array(count);
  let loudest = 0;
  for (let bucket = 0; bucket < count; bucket += 1) {
    const from = Math.floor((bucket * length) / count);
    const to = Math.max(from + 1, Math.floor(((bucket + 1) * length) / count));
    let low = 0;
    let high = 0;
    for (const set of sets) {
      const end = Math.ceil(to / LEAF_FRAMES);
      for (let leaf = Math.floor(from / LEAF_FRAMES); leaf < end; leaf += 1) {
        const at = set * size + leaf * 4;
        // A leaf of no frame holds nothing to draw.
        if ((leaves[at + 3] ?? 0) > 0) {
          low = Math.min(low, leaves[at] ?? 0);
          high = Math.max(high, leaves[at + 1] ?? 0);
        }
      }
    }
    min[bucket] = low;
    max[bucket] = high;
    loudest = Math.max(loudest, -low, high);
  }
  // Scaled as `normalizePeaks` scales them: the loudest sample at full height.
  if (loudest > 0) {
    for (let bucket = 0; bucket < count; bucket += 1) {
      min[bucket] = (min[bucket] ?? 0) / loudest;
      max[bucket] = (max[bucket] ?? 0) / loudest;
    }
  }
  return { max, min };
}

/** The peaks of `channels`' loudest channel and their chroma, at `sampleRate`. */
export function measureSound(
  channels: readonly Float32Array[],
  sampleRate: number
): Measured {
  return {
    chroma: audioChroma([...channels], sampleRate),
    peaks: measurePeaks(channels, sampleRate),
  };
}
