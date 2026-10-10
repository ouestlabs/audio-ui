/** Bars smaller than this would vanish on silence; a sliver keeps the timeline readable. */
const MIN_BAR_HEIGHT_PX = 2;

export type WaveformVariant = "bars" | "mirror";

/** Where the bars go on the canvas bitmap. Every length is in device pixels. */
export interface BarLayout {
  barWidth: number;
  count: number;
  height: number;
  minBarHeight: number;
  /** Distance between the left edges of two neighbouring bars. */
  pitch: number;
  variant: WaveformVariant;
}

export interface BarLayoutOptions {
  /** Space between bars, in CSS pixels. */
  barGap: number;
  /** Bar width, in CSS pixels. */
  barWidth: number;
  /** Bitmap height, in device pixels. */
  height: number;
  /** Device pixels per CSS pixel. */
  pixelRatio: number;
  variant: WaveformVariant;
  /** Bitmap width, in device pixels. */
  width: number;
}

export interface BarRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * How many device pixels a CSS length covers on the canvas bitmap. The
 * browser's own count is exact where a layout box doesn't land on a whole
 * pixel, so it wins when it agrees with the pixel ratio. It doesn't under
 * device emulation, which reports the real screen's pixels.
 */
export function bitmapLength(
  cssLength: number,
  pixelRatio: number,
  exact?: number
): number {
  const estimate = Math.round(cssLength * pixelRatio);
  return exact !== undefined && Math.abs(exact - estimate) <= 1
    ? exact
    : estimate;
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

/** A CSS length in whole device pixels: at least one, so nothing thin disappears. */
function snap(length: number, pixelRatio: number): number {
  return length > 0 ? Math.max(1, Math.round(length * pixelRatio)) : 0;
}

/**
 * Lay the bars out on the device pixel grid. Widths and gaps given in CSS
 * pixels become whole device pixels, so every bar is the same width and no
 * edge falls between two pixels, whatever the pixel density or zoom level.
 */
export function barLayout(options: BarLayoutOptions): BarLayout {
  const { height, pixelRatio, variant, width } = options;
  const barWidth = snap(options.barWidth, pixelRatio);
  const barGap = snap(options.barGap, pixelRatio);
  return {
    barWidth,
    count: barCount(width, barWidth, barGap),
    height,
    minBarHeight: snap(MIN_BAR_HEIGHT_PX, pixelRatio),
    pitch: barWidth + barGap,
    variant,
  };
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
    let loudest = 0;
    for (let i = start; i < end && i < length; i += 1) {
      loudest = Math.max(loudest, magnitude(peaks, i));
    }
    levels[bar] = loudest;
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
 * Fit `peaks` to one level per bar. With more peaks than bars, each bar takes
 * the loudest peak in its slice, so a short transient never disappears between
 * bars; with fewer, neighbouring peaks are blended so the shape stays smooth
 * instead of stepping.
 */
export function resamplePeaks(
  peaks: ArrayLike<number>,
  count: number
): Float32Array {
  const levels = new Float32Array(Math.max(0, count));
  if (peaks.length === 0) {
    return levels;
  }
  if (peaks.length < levels.length) {
    stretchPeaks(peaks, levels);
  } else {
    reducePeaks(peaks, levels);
  }
  return levels;
}

/**
 * Where bar `index` goes for a level of 0…1, in whole device pixels. `mirror`
 * centers it; `bars` stands it on the baseline.
 */
export function barRect(
  level: number,
  index: number,
  layout: BarLayout
): BarRect {
  const { barWidth, height, minBarHeight, pitch, variant } = layout;
  const barHeight = Math.min(
    height,
    Math.max(minBarHeight, Math.round(level * height))
  );
  return {
    height: barHeight,
    width: barWidth,
    x: index * pitch,
    y:
      variant === "mirror"
        ? Math.round((height - barHeight) / 2)
        : height - barHeight,
  };
}
