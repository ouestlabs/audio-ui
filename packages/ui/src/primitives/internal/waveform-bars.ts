/** Bars smaller than this would vanish on silence; a sliver keeps the timeline readable. */
const MIN_BAR_HEIGHT_PX = 2;
/** Quiet bars stay visible, loud ones reach full strength. */
const MIN_BAR_ALPHA = 0.3;

export type WaveformVariant = "bars" | "mirror";

export interface BarLayout {
  barGap: number;
  barWidth: number;
  height: number;
  variant: WaveformVariant;
}

export interface BarRect {
  /** Opacity for the bar: louder bars are more opaque. */
  alpha: number;
  height: number;
  width: number;
  x: number;
  y: number;
}

/** How many bars of `barWidth` separated by `barGap` fit in `width`. */
export function barCount(
  width: number,
  barWidth: number,
  barGap: number
): number {
  if (width <= 0 || barWidth <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor((width + barGap) / (barWidth + barGap)));
}

/**
 * Reduce `peaks` to one level per bar. Each bar takes the loudest peak in its
 * slice of the data, so a short transient never disappears between bars; with
 * fewer peaks than bars, neighbouring bars repeat the nearest peak.
 */
export function resamplePeaks(
  peaks: ArrayLike<number>,
  count: number
): Float32Array {
  const levels = new Float32Array(Math.max(0, count));
  const { length } = peaks;
  if (length === 0) {
    return levels;
  }
  for (let bar = 0; bar < levels.length; bar += 1) {
    const start = Math.floor((bar * length) / levels.length);
    const end = Math.max(
      start + 1,
      Math.floor(((bar + 1) * length) / levels.length)
    );
    let loudest = 0;
    for (let i = start; i < end && i < length; i += 1) {
      const peak = Math.abs(peaks[i] ?? 0);
      if (peak > loudest) {
        loudest = peak;
      }
    }
    levels[bar] = Math.min(1, loudest);
  }
  return levels;
}

/** Where bar `index` goes for a level of 0…1. `mirror` centers it; `bars` stands it on the baseline. */
export function barRect(
  level: number,
  index: number,
  layout: BarLayout
): BarRect {
  const { barGap, barWidth, height, variant } = layout;
  const barHeight = Math.min(
    height,
    Math.max(MIN_BAR_HEIGHT_PX, level * height)
  );
  return {
    alpha: MIN_BAR_ALPHA + level * (1 - MIN_BAR_ALPHA),
    height: barHeight,
    width: barWidth,
    x: index * (barWidth + barGap),
    y: variant === "mirror" ? (height - barHeight) / 2 : height - barHeight,
  };
}
