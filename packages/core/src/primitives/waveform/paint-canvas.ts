import { createFrameTask } from "../../dom/frame.ts";
import { observeVisibility } from "../../dom/visibility.ts";
import { clampUnit } from "../../shared/math.ts";
import type { Source } from "../../value/source.ts";
import {
  type BarLayout,
  type BarRect,
  barLayout,
  barRects,
  bitmapLength,
  envelopeRects,
  mirroredScrollRects,
  scrollShift,
  type WaveformVariant,
} from "./bar-layout.ts";
import { createLevelHistory, type LevelHistory } from "./level-history.ts";
import { loudest } from "./levels.ts";
import {
  createLevelsEngine,
  type LevelsEngine,
  type WaveformIdle,
} from "./levels-engine.ts";
import type { WaveformPlayed } from "./paint-bars.ts";
import {
  fitPeaks,
  type PeakEnvelope,
  rangeShares,
  type WaveformPeaks,
} from "./peaks.ts";
import { type ScopePoint, scopePoints } from "./scope.ts";

const BAR_RADIUS_PROPERTY = "--waveform-bar-radius";
const THEME_ATTRIBUTES = ["class", "style", "data-theme"];
/** With reduced motion, a moving waveform repaints this often at most. */
const REDUCED_MOTION_INTERVAL_MS = 250;
const MS_PER_SECOND = 1000;
/**
 * Browsers refuse canvases much larger than this on a side, and a refused
 * canvas draws nothing. Past it the bitmap is drawn coarser instead: a
 * zoomed-in clip blurs a little rather than going blank.
 */
const MAX_BITMAP_SIDE = 16_384;

let barRadiusPropertyRegistered = false;

/**
 * Registers the bar radius as a CSS length, so a themed value such as
 * `min(var(--radius-sm), 3px)` computes to pixels the canvas can draw with.
 */
function registerBarRadiusProperty() {
  if (barRadiusPropertyRegistered) {
    return;
  }
  barRadiusPropertyRegistered = true;
  if (typeof CSS === "undefined" || !("registerProperty" in CSS)) {
    return;
  }
  try {
    CSS.registerProperty({
      inherits: true,
      initialValue: "0px",
      name: BAR_RADIUS_PROPERTY,
      syntax: "<length>",
    });
  } catch {
    // Already registered by another copy of the library.
  }
}

/** One rectangle per bar. */
function barsPath(rects: BarRect[], radius: number): Path2D {
  const path = new Path2D();
  for (const bar of rects) {
    if (radius > 0 && typeof path.roundRect === "function") {
      path.roundRect(
        bar.x,
        bar.y,
        bar.width,
        bar.height,
        Math.min(radius, bar.width / 2, bar.height / 2)
      );
    } else {
      path.rect(bar.x, bar.y, bar.width, bar.height);
    }
  }
  return path;
}

/** One closed shape: along the top of every bar, then back along the bottoms. */
function linePath(rects: BarRect[]): Path2D {
  const path = new Path2D();
  for (const bar of rects) {
    path.lineTo(bar.x + bar.width / 2, bar.y);
  }
  for (let index = rects.length - 1; index >= 0; index -= 1) {
    const bar = rects[index];
    if (bar) {
      path.lineTo(bar.x + bar.width / 2, bar.y + bar.height);
    }
  }
  path.closePath();
  return path;
}

/** One open line through the points, to be stroked. */
function scopePath(points: ScopePoint[]): Path2D {
  const path = new Path2D();
  for (const point of points) {
    path.lineTo(point.x, point.y);
  }
  return path;
}

/** The options of `attachWaveformCanvas`: the peaks or a live signal, the stretch shown and the played share, the variant, the bars' size, and how the drawing moves. */
export interface WaveformCanvasOptions {
  /** Space between bars, in CSS pixels, snapped to whole device pixels. @default 1 */
  barGap?: number;
  /** Bar corner radius, in CSS pixels. Defaults to the `--waveform-bar-radius` CSS length. */
  barRadius?: number;
  /** Bar width, in CSS pixels, snapped to whole device pixels. @default 2 */
  barWidth?: number;
  /** Length of the audio, in the unit `range` is in. */
  duration: number;
  /** Visual gain applied to the levels before they are drawn. @default 1 */
  gain?: number;
  /** What the bars do while there is no signal, outside the scrolling mode. @default "none" */
  idle?: WaveformIdle;
  /** A live signal, followed instead of `peaks`: levels 0…1, or raw samples for `scope`. */
  levels?: Source<ArrayLike<number>>;
  /** Thickness of the `scope` trace, in CSS pixels. @default 1.5 */
  lineWidth?: number;
  /** Whether the audio is still on its way: the bars sweep. */
  loading?: boolean;
  /** Shortest bar, in CSS pixels. @default 2 */
  minBarHeight?: number;
  /** Makes the drawing symmetric around the middle. */
  mirrored?: boolean;
  /** How a live signal is drawn: the current levels across the width, or a scrolling record of the loudest. @default "static" */
  mode?: "scrolling" | "static";
  /** The audio's shape, when it is known upfront. */
  peaks?: WaveformPeaks;
  /** The played share, drawn in `--waveform-progress-color`. */
  played: WaveformPlayed;
  /** The stretch of the audio shown, `[start, end]` in `duration` units. */
  range: readonly [number, number];
  /** Whether motion is reduced: a moving waveform repaints four times a second at most. */
  reducedMotion?: boolean;
  /** How fast the scrolling mode moves, in CSS pixels per second. @default 60 */
  scrollSpeed?: number;
  /** `mirror`, `bars`, `line`, or `scope` for raw samples. @default "mirror" */
  variant?: WaveformVariant;
}

/**
 * Draws a waveform on `canvas`, laid out on the device pixel grid: as many
 * bars as fit its width, every edge on a physical pixel, so it stays sharp
 * at any pixel density and zoom level. It paints only when something
 * changed, and not at all while it is off screen. The played part is drawn
 * in the `--waveform-progress-color` CSS color and the rest in
 * `--waveform-color`, both the text color by default. Returns what stops it.
 */
export function attachWaveformCanvas(
  canvas: HTMLCanvasElement,
  options: WaveformCanvasOptions
): () => void {
  const context = canvas.getContext("2d");
  if (!context || typeof ResizeObserver === "undefined") {
    return () => undefined;
  }
  const { barRadius, duration, levels: live, peaks, played, range } = options;
  const barGap = options.barGap ?? 1;
  const barWidth = options.barWidth ?? 2;
  const gain = options.gain ?? 1;
  const idle = options.idle ?? "none";
  const lineWidth = options.lineWidth ?? 1.5;
  const loading = options.loading ?? false;
  const minBarHeight = options.minBarHeight ?? 2;
  const mirrored = options.mirrored ?? false;
  const mode = options.mode ?? "static";
  const reducedMotion = options.reducedMotion ?? false;
  const scrollSpeed = options.scrollSpeed ?? 60;
  const variant = options.variant ?? "mirror";
  registerBarRadiusProperty();
  let layout: BarLayout | null = null;
  let engine: LevelsEngine | null = null;
  let history: LevelHistory | null = null;
  /** The file's shape over the shown stretch, when it is drawn as it is rather than live. */
  let envelope: PeakEnvelope | null = null;
  /** A live record's levels, carried over when a resize starts a new one. */
  let previousHistory: Float32Array | undefined;
  /** Bitmap px per CSS px: the pixel density, unless the bitmap had to be capped. */
  let bitmapRatio = window.devicePixelRatio || 1;
  let shape = new Path2D();
  let radius = 0;
  let strokeWidth = 0;
  let input: ArrayLike<number> | undefined = live?.getSnapshot();
  // Whether the bars must be laid out again before the next paint.
  let stale = true;
  // Whether the levels may have moved since the shape was built.
  let moving = true;
  // A resize must repaint at once, whatever would otherwise wait.
  let urgent = false;
  let visible = true;
  let clock = 0;
  let running = false;
  let unpaintedMs = 0;
  let sincePaintMs = Number.POSITIVE_INFINITY;

  /** Sets up what the bars follow: the file as it is, a live record, or live levels. */
  const prepareLevels = (grid: BarLayout, pixelRatio: number) => {
    engine = null;
    envelope = null;
    history = null;
    if (variant === "scope") {
      return;
    }
    if (!(live || loading)) {
      // A file's shape is known: drawn as it is, with nothing to animate.
      const [from, to] = rangeShares(range, duration);
      envelope = fitPeaks(peaks ?? [], from, to, {
        high: new Float32Array(grid.count),
        low: new Float32Array(grid.count),
      });
      return;
    }
    if (live && mode === "scrolling") {
      // One entry more than fits: the newest slides in as the oldest slides
      // out. From the middle outwards, each side shows half as many.
      const pitch = grid.pitch / pixelRatio;
      history = createLevelHistory(
        (mirrored ? Math.ceil(grid.count / 2) : grid.count) + 1,
        (pitch / Math.max(scrollSpeed, 1)) * MS_PER_SECOND,
        previousHistory
      );
      return;
    }
    engine = createLevelsEngine({
      count: grid.count,
      gain,
      idle,
      loading,
      minLevel: 0,
      mirrored,
      reducedMotion,
    });
  };

  const measure = () => {
    stale = false;
    const pixelRatio = bitmapRatio;
    layout = barLayout({
      barGap,
      barWidth,
      height: canvas.height,
      minBarHeight,
      pixelRatio,
      variant,
      width: canvas.width,
    });
    radius =
      (barRadius ??
        (Number.parseFloat(
          getComputedStyle(canvas).getPropertyValue(BAR_RADIUS_PROPERTY)
        ) ||
          0)) * pixelRatio;
    strokeWidth = lineWidth * pixelRatio;
    previousHistory = history?.levels;
    prepareLevels(layout, pixelRatio);
    moving = true;
  };

  /** Where the bars are now. Sets `running` while they are still moving. */
  const place = (grid: BarLayout): BarRect[] => {
    if (envelope) {
      return envelopeRects(envelope, grid);
    }
    if (history) {
      running = history.step(performance.now());
      const progress = reducedMotion ? 1 : history.progress;
      return mirrored
        ? mirroredScrollRects(history.levels, progress, grid)
        : barRects(
            history.levels,
            grid,
            scrollShift(history.levels.length, progress, grid)
          );
    }
    if (engine) {
      engine.step(clock, input);
      running = !engine.settled;
      return barRects(engine.levels, grid);
    }
    return [];
  };

  /** Move the levels on by `elapsedMs` and rebuild the shape. Returns `true` while they are still moving. */
  const advance = (elapsedMs: number): boolean => {
    if (!layout) {
      return false;
    }
    clock += elapsedMs;
    running = false;
    if (variant === "scope") {
      shape = scopePath(
        scopePoints(input ?? [], {
          gain,
          height: layout.height,
          inset: strokeWidth,
          width: layout.width,
        })
      );
      return false;
    }
    const rects = place(layout);
    shape = variant === "line" ? linePath(rects) : barsPath(rects, radius);
    return running;
  };

  /** Ink the shape in `color`, between two columns of the bitmap. */
  const ink = (color: string, from: number, to: number) => {
    if (to <= from) {
      return;
    }
    context.save();
    context.beginPath();
    context.rect(from, 0, to - from, canvas.height);
    context.clip();
    if (variant === "scope") {
      context.lineJoin = "round";
      context.lineWidth = strokeWidth;
      context.strokeStyle = color;
      context.stroke(shape);
    } else {
      context.fillStyle = color;
      context.fill(shape);
    }
    context.restore();
  };

  const draw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const computed = getComputedStyle(canvas);
    const color =
      computed.getPropertyValue("--waveform-color").trim() || computed.color;
    const progressColor =
      computed.getPropertyValue("--waveform-progress-color").trim() || color;
    // Split on a whole pixel: no column ever blends the two colors.
    const split = Math.round(played.get() * canvas.width);
    ink(progressColor, 0, split);
    ink(color, split, canvas.width);
  };

  const task = createFrameTask((elapsedMs) => {
    const mustPaint = urgent;
    urgent = false;
    if (!(visible || mustPaint)) {
      return false;
    }
    unpaintedMs += elapsedMs;
    sincePaintMs += elapsedMs;
    const throttled =
      reducedMotion && moving && sincePaintMs < REDUCED_MOTION_INTERVAL_MS;
    if (throttled && !mustPaint) {
      return true;
    }
    if (stale) {
      measure();
    }
    if (moving) {
      moving = advance(unpaintedMs);
    }
    unpaintedMs = 0;
    sincePaintMs = 0;
    draw();
    return moving;
  });

  // The bar radius is read from CSS: lay out again when it may have changed.
  const invalidate = () => {
    stale = true;
    task.wake();
  };

  const resize = (entry: ResizeObserverEntry) => {
    const pixelRatio = window.devicePixelRatio || 1;
    const exact = entry.devicePixelContentBoxSize?.[0];
    const fullWidth = bitmapLength(
      entry.contentRect.width,
      pixelRatio,
      exact?.inlineSize
    );
    const fullHeight = bitmapLength(
      entry.contentRect.height,
      pixelRatio,
      exact?.blockSize
    );
    const cap = Math.min(
      1,
      MAX_BITMAP_SIDE / Math.max(fullWidth, 1),
      MAX_BITMAP_SIDE / Math.max(fullHeight, 1)
    );
    const width = Math.max(1, Math.floor(fullWidth * cap));
    const height = Math.max(1, Math.floor(fullHeight * cap));
    bitmapRatio =
      entry.contentRect.width > 0
        ? width / entry.contentRect.width
        : pixelRatio * cap;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    // Resizing clears the bitmap: repaint now, before the browser shows it.
    stale = true;
    urgent = true;
    task.flush();
  };

  // A resize is drawn on the next frame, still before it is shown: drawing
  // it in the observer's callback changes the canvas inside the layout pass
  // that measured it.
  let resizeFrame = 0;
  const resizeObserver = new ResizeObserver(([entry]) => {
    if (entry) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => resize(entry));
    }
  });
  // Observing again reports the size afresh.
  const observe = () => {
    resizeObserver.unobserve(canvas);
    try {
      resizeObserver.observe(canvas, { box: "device-pixel-content-box" });
    } catch {
      // Device pixel sizes aren't reported here: CSS pixel sizes will do.
      resizeObserver.observe(canvas);
    }
  };
  observe();

  const themeObserver = new MutationObserver(invalidate);
  themeObserver.observe(document.documentElement, {
    attributeFilter: THEME_ATTRIBUTES,
    attributes: true,
  });

  const abort = new AbortController();
  const { signal } = abort;
  // A zoom, or a move to another screen, changes the pixel density without
  // resizing the canvas in CSS pixels.
  const watchPixelRatio = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      "change",
      () => {
        watchPixelRatio();
        observe();
      },
      { once: true, signal }
    );
  };
  if (typeof matchMedia === "function") {
    watchPixelRatio();
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      invalidate,
      { signal }
    );
  }

  const stopObservingVisibility = observeVisibility(canvas, (next) => {
    visible = next;
    if (next) {
      task.wake();
    }
  });
  const unsubscribePlayed = played.subscribe(task.wake);
  const unsubscribeLevels = live?.subscribe(() => {
    input = live.getSnapshot();
    if (history) {
      // The record follows the signal, not the paints: it stays true while
      // the canvas is off screen or holds its frames back.
      const now = performance.now();
      history.feed(clampUnit(loudest(input) * gain), now);
      history.step(now);
    }
    moving = true;
    task.wake();
  });

  return () => {
    task.stop();
    abort.abort();
    cancelAnimationFrame(resizeFrame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    stopObservingVisibility();
    unsubscribePlayed();
    unsubscribeLevels?.();
  };
}
