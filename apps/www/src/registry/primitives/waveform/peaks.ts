/**
 * The audio's shape, one entry per slice of it: either a level per slice
 * (0…1, drawn the same above and below the middle) or the lowest and highest
 * sample of each slice (-1…1), which draws the waveform as it really is,
 * lopsided where the audio is.
 */
export type WaveformPeaks =
  | ArrayLike<number>
  | { max: ArrayLike<number>; min: ArrayLike<number> };

/** Where each bar reaches above and below the middle: `high` 0…1 up, `low` 0…-1 down. */
export interface PeakEnvelope {
  high: Float32Array;
  low: Float32Array;
}

const clampSample = (value: number) => Math.min(1, Math.max(-1, value));

/** How many entries `peaks` holds. */
export function peakCount(peaks: WaveformPeaks): number {
  return "max" in peaks
    ? Math.min(peaks.max.length, peaks.min.length)
    : peaks.length;
}

/** The highest and lowest sample of entry `index`. */
function peakAt(peaks: WaveformPeaks, index: number): [number, number] {
  if ("max" in peaks) {
    return [
      clampSample(peaks.max[index] ?? 0),
      clampSample(peaks.min[index] ?? 0),
    ];
  }
  const level = Math.min(1, Math.abs(peaks[index] ?? 0));
  return [level, -level];
}

/**
 * Fits the stretch of `peaks` from `from` to `to` (shares of the whole, 0…1)
 * to one high and one low per bar of `envelope`. With more entries than bars,
 * each bar keeps the highest and the lowest of its slice, so a transient
 * never disappears between bars; with fewer, it blends its two nearest
 * entries so the shape stays smooth. Outside the data, bars are silent.
 */
export function fitPeaks(
  peaks: WaveformPeaks,
  from: number,
  to: number,
  envelope: PeakEnvelope
): PeakEnvelope {
  const { high, low } = envelope;
  const bars = high.length;
  const count = peakCount(peaks);
  high.fill(0);
  low.fill(0);
  if (count === 0 || bars === 0 || !(to > from)) {
    return envelope;
  }
  const first = from * count;
  const span = ((to - from) * count) / bars;
  for (let bar = 0; bar < bars; bar += 1) {
    const start = first + bar * span;
    const end = start + span;
    if (span >= 1) {
      const begin = Math.max(0, Math.floor(start));
      const stop = Math.min(count, Math.max(begin + 1, Math.floor(end)));
      let top = 0;
      let bottom = 0;
      for (let index = begin; index < stop; index += 1) {
        const [upper, lower] = peakAt(peaks, index);
        top = Math.max(top, upper);
        bottom = Math.min(bottom, lower);
      }
      high[bar] = top;
      low[bar] = bottom;
      continue;
    }
    const at = (start + end) / 2 - 0.5;
    if (at < -0.5 || at > count - 0.5) {
      continue;
    }
    const before = Math.min(count - 1, Math.max(0, Math.floor(at)));
    const after = Math.min(count - 1, before + 1);
    const blend = Math.min(1, Math.max(0, at - before));
    const [upperFrom, lowerFrom] = peakAt(peaks, before);
    const [upperTo, lowerTo] = peakAt(peaks, after);
    high[bar] = upperFrom + (upperTo - upperFrom) * blend;
    low[bar] = lowerFrom + (lowerTo - lowerFrom) * blend;
  }
  return envelope;
}

/**
 * The shares of the whole audio that the stretch `range` covers, for
 * `fitPeaks`: `[start, end]` in `duration` units becomes `[from, to]` in 0…1.
 */
export function rangeShares(
  range: readonly [number, number],
  duration: number
): [number, number] {
  return duration > 0 ? [range[0] / duration, range[1] / duration] : [0, 1];
}

/** A level per entry of the stretch from `from` to `to`: how far each slice reaches either way. */
export function peakMagnitudes(
  peaks: WaveformPeaks,
  from: number,
  to: number,
  count: number
): Float32Array {
  const { high, low } = fitPeaks(peaks, from, to, {
    high: new Float32Array(Math.max(0, count)),
    low: new Float32Array(Math.max(0, count)),
  });
  return high.map((top, index) => Math.max(top, -(low[index] ?? 0)));
}
