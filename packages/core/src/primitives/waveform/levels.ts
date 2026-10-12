/** Loudest level under which a signal counts as silence. */
export const SILENCE_THRESHOLD = 0.02;

/** The loudest magnitude in `levels`. */
export function loudest(levels: ArrayLike<number>): number {
  let max = 0;
  // biome-ignore lint/style/useForOf: an ArrayLike is not iterable
  for (let index = 0; index < levels.length; index += 1) {
    max = Math.max(max, Math.abs(levels[index] ?? 0));
  }
  return max;
}

/** Whether `levels` carry a signal, rather than silence. */
export function isAudible(levels: ArrayLike<number>): boolean {
  return loudest(levels) >= SILENCE_THRESHOLD;
}

const magnitude = (peaks: ArrayLike<number>, index: number): number =>
  Math.min(1, Math.abs(peaks[index] ?? 0));

/** More peaks than bars: each bar keeps the loudest peak in its slice of the data. */
function reducePeaks(peaks: ArrayLike<number>, levels: Float32Array) {
  const { length } = peaks;
  for (let bar = 0; bar < levels.length; bar += 1) {
    const start = Math.floor((bar * length) / levels.length);
    const end = Math.max(
      start + 1,
      Math.floor(((bar + 1) * length) / levels.length)
    );
    let peak = 0;
    for (let i = start; i < end && i < length; i += 1) {
      peak = Math.max(peak, magnitude(peaks, i));
    }
    levels[bar] = peak;
  }
}

/** Fewer peaks than bars: each bar blends its two nearest peaks, aligned on their centers. */
function stretchPeaks(peaks: ArrayLike<number>, levels: Float32Array) {
  const last = peaks.length - 1;
  for (let bar = 0; bar < levels.length; bar += 1) {
    const at = Math.min(
      last,
      Math.max(0, ((bar + 0.5) * peaks.length) / levels.length - 0.5)
    );
    const before = Math.floor(at);
    const from = magnitude(peaks, before);
    const to = magnitude(peaks, Math.min(last, before + 1));
    levels[bar] = from + (to - from) * (at - before);
  }
}

/**
 * Fit `peaks` to `levels`, one level per bar. With more peaks than bars, each
 * bar takes the loudest peak in its slice, so a short transient never
 * disappears between bars; with fewer, neighbouring peaks are blended so the
 * shape stays smooth instead of stepping. Returns `levels`.
 */
export function fitPeaks(
  peaks: ArrayLike<number>,
  levels: Float32Array
): Float32Array {
  if (peaks.length === 0) {
    levels.fill(0);
  } else if (peaks.length < levels.length) {
    stretchPeaks(peaks, levels);
  } else {
    reducePeaks(peaks, levels);
  }
  return levels;
}
