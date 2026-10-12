/**
 * `bars` stands the bars on the baseline, `mirror` centers them on the middle
 * line, and `line` joins the levels into one continuous, centered shape.
 * `scope` is for raw samples rather than levels: it traces them, -1…1, as a
 * single line through the middle, like an oscilloscope.
 */
export type WaveformVariant = "bars" | "line" | "mirror" | "scope";

import type { PeakEnvelope } from "./peaks.ts";

/** Where the bars go on the canvas bitmap. Every length is in device pixels. */
export interface BarLayout {
  barWidth: number;
  count: number;
  height: number;
  minBarHeight: number;
  /** Distance between the left edges of two neighbouring bars. */
  pitch: number;
  variant: WaveformVariant;
  width: number;
}

export interface BarLayoutOptions {
  /** Space between bars, in CSS pixels. */
  barGap: number;
  /** Bar width, in CSS pixels. */
  barWidth: number;
  /** Bitmap height, in device pixels. */
  height: number;
  /** Shortest bar, in CSS pixels: silence still draws a sliver, so the timeline stays readable. */
  minBarHeight: number;
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
    minBarHeight: snap(options.minBarHeight, pixelRatio),
    pitch: barWidth + barGap,
    variant,
    width,
  };
}

/**
 * Where bar `index` goes for a level of 0…1, in whole device pixels. `bars`
 * stands it on the baseline; the other variants center it. `shift` moves the
 * whole row, for a waveform that scrolls.
 */
export function barRect(
  level: number,
  index: number,
  layout: BarLayout,
  shift = 0
): BarRect {
  const { barWidth, height, minBarHeight, pitch, variant } = layout;
  const barHeight = Math.min(
    height,
    Math.max(minBarHeight, Math.round(level * height))
  );
  return {
    height: barHeight,
    width: barWidth,
    x: index * pitch + shift,
    y:
      variant === "bars"
        ? height - barHeight
        : Math.round((height - barHeight) / 2),
  };
}

/**
 * How far to shift a row of `count` bars so the last one sits flush with the
 * right edge once it has fully slid in. `progress` is how far it has, 0…1; the
 * slide moves in whole device pixels, so bars stay sharp while they scroll.
 */
export function scrollShift(
  count: number,
  progress: number,
  layout: BarLayout
): number {
  const { barWidth, pitch, width } = layout;
  const settled = width - barWidth - (count - 1) * pitch;
  return settled + Math.round((1 - Math.min(1, Math.max(0, progress))) * pitch);
}

/** Where each level goes, left to right. `shift` moves the whole row. */
export function barRects(
  levels: ArrayLike<number>,
  layout: BarLayout,
  shift = 0
): BarRect[] {
  return Array.from(levels, (level, index) =>
    barRect(level, index, layout, shift)
  );
}

/**
 * Where each level of a history goes when it scrolls outwards from the
 * middle, left to right: the newest stays in the center, growing out of the
 * one before it, while older ones slide away on both sides. `progress` is how
 * far the newest has come in, 0…1.
 */
export function mirroredScrollRects(
  levels: ArrayLike<number>,
  progress: number,
  layout: BarLayout
): BarRect[] {
  const last = levels.length - 1;
  if (last < 0) {
    return [];
  }
  const { barWidth, pitch, width } = layout;
  const center = Math.round((width - barWidth) / 2);
  const slide = Math.min(1, Math.max(0, progress));
  const newest = levels[last] ?? 0;
  const previous = levels[last - 1] ?? newest;
  const left: BarRect[] = [];
  const right: BarRect[] = [];
  for (let age = 1; age <= last; age += 1) {
    const distance = Math.round((age - 1 + slide) * pitch);
    if (distance > center + barWidth) {
      break;
    }
    const level = levels[last - age] ?? 0;
    left.unshift(barRect(level, 0, layout, center - distance));
    right.push(barRect(level, 0, layout, center + distance));
  }
  const middle = barRect(
    previous + (newest - previous) * slide,
    0,
    layout,
    center
  );
  return [...left, middle, ...right];
}

/**
 * Where each bar of an envelope goes, in whole device pixels: from its high
 * to its low around the middle, never thinner than the shortest bar. `bars`
 * stands each one on the baseline instead, as tall as it reaches either way.
 */
export function envelopeRects(
  envelope: PeakEnvelope,
  layout: BarLayout
): BarRect[] {
  const { barWidth, height, minBarHeight, pitch, variant } = layout;
  const middle = height / 2;
  return Array.from(envelope.high, (high, index) => {
    const low = envelope.low[index] ?? 0;
    if (variant === "bars") {
      return barRect(Math.max(high, -low), index, layout);
    }
    let top = Math.round(middle - high * middle);
    let bottom = Math.round(middle - low * middle);
    if (bottom - top < minBarHeight) {
      top = Math.round((top + bottom - minBarHeight) / 2);
      bottom = top + minBarHeight;
    }
    return { height: bottom - top, width: barWidth, x: index * pitch, y: top };
  });
}
