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

/** The peaks of `channels`' loudest channel and their chroma, at `sampleRate`. */
export function measureSound(
  channels: readonly Float32Array[],
  sampleRate: number
): Measured {
  const length = (channels[0]?.length ?? 0) / sampleRate;
  const peaks = normalizePeaks(
    computePeaks([...channels], peakCountFor(length))
  );
  return {
    chroma: audioChroma([...channels], sampleRate),
    peaks: {
      max: Float32Array.from(peaks.max),
      min: Float32Array.from(peaks.min),
    },
  };
}
