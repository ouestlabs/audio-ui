import { clampUnit, createFrameTask, observeVisibility } from "@audio-ui/core";
import {
  type BarLayout,
  type BarRect,
  barLayout,
  barRects,
  bitmapLength,
  createLevelHistory,
  createLevelsEngine,
  envelopeRects,
  fitPeaks,
  type LevelHistory,
  type LevelsEngine,
  loudest,
  mirroredScrollRects,
  type PeakEnvelope,
  rangeShares,
  type ScopePoint,
  scopePoints,
  scrollShift,
  type WaveformIdle,
  type WaveformVariant,
} from "@audio-ui/core/waveform";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useReducedMotion } from "../../internal/use-reduced-motion.ts";
import { useWaveformContext, type WaveformState } from "../context.ts";

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

/**
 * Draws the waveform on a canvas, laid out on the device pixel grid: as many
 * bars as fit its width, every edge on a physical pixel, so it stays sharp at
 * any pixel density and zoom level. It paints only when something changed,
 * and not at all while it is off screen.
 *
 * With `peaks`, the played part is drawn in one color and the rest in another.
 * With a live `levels` signal, `mode` picks between the current levels across
 * the width and a scrolling record of the loudest one. The `scope` variant
 * takes raw samples instead of levels, and traces them as they are.
 *
 * Colors come from CSS: `--waveform-color` and `--waveform-progress-color`
 * (both default to the text color). The bar corner radius is `barRadius`, or
 * the `--waveform-bar-radius` CSS length. Renders a `<canvas>` element.
 */
export function Canvas(componentProps: Canvas.Props) {
  const {
    barGap = 1,
    barRadius,
    barWidth = 2,
    className,
    gain = 1,
    idle = "none",
    lineWidth = 1.5,
    minBarHeight = 2,
    mirrored = false,
    mode = "static",
    ref,
    render,
    scrollSpeed = 60,
    style,
    variant = "mirror",
    ...elementProps
  } = componentProps;
  const { meta, state } = useWaveformContext("Canvas");
  const { duration, levels: live, peaks, position, range } = meta;
  const { loading } = state;
  const reducedMotion = useReducedMotion();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!(canvas && context) || typeof ResizeObserver === "undefined") {
      return;
    }
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
      const played = Math.round(position.get() * canvas.width);
      ink(progressColor, 0, played);
      ink(color, played, canvas.width);
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

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) {
        resize(entry);
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

    const controller = new AbortController();
    const { signal } = controller;
    // A zoom, or a move to another screen, changes the pixel density without
    // resizing the canvas in CSS pixels.
    const watchPixelRatio = () => {
      matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`
      ).addEventListener(
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
    const unsubscribePosition = position.subscribe(task.wake);
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
      controller.abort();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      stopObservingVisibility();
      unsubscribePosition();
      unsubscribeLevels?.();
    };
  }, [
    barGap,
    barRadius,
    barWidth,
    gain,
    idle,
    lineWidth,
    live,
    loading,
    minBarHeight,
    mirrored,
    mode,
    duration,
    peaks,
    position,
    range,
    reducedMotion,
    scrollSpeed,
    variant,
  ]);

  return useRender({
    defaultTagName: "canvas",
    props: mergeProps<"canvas">(
      { "aria-hidden": true },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, canvasRef] : canvasRef,
    render,
    state,
  });
}

export namespace Canvas {
  export type State = WaveformState;
  export interface Props extends PartProps<"canvas", State> {
    /** Space between bars, in CSS pixels, snapped to whole device pixels. @default 1 */
    barGap?: number;
    /** Bar corner radius, in CSS pixels. Defaults to the `--waveform-bar-radius` CSS length. */
    barRadius?: number;
    /** Bar width, in CSS pixels, snapped to whole device pixels. @default 2 */
    barWidth?: number;
    /** Visual gain applied to the levels before they are drawn. @default 1 */
    gain?: number;
    /** What the bars do while there is no signal, outside the scrolling mode. @default "none" */
    idle?: WaveformIdle;
    /** Thickness of the `scope` trace, in CSS pixels. @default 1.5 */
    lineWidth?: number;
    /** Shortest bar, in CSS pixels: silence still draws a sliver, so the timeline stays readable. @default 2 */
    minBarHeight?: number;
    /**
     * Makes the drawing symmetric around the middle: the first level sits in
     * the center, or, when scrolling, the newest one, with older ones moving
     * out on both sides.
     * @default false
     */
    mirrored?: boolean;
    /**
     * How a live `levels` signal is drawn: `static` spreads the current levels
     * across the width; `scrolling` records the loudest one over time, the
     * newest entering from the right.
     * @default "static"
     */
    mode?: "scrolling" | "static";
    /** How fast the scrolling mode moves, in CSS pixels per second. @default 60 */
    scrollSpeed?: number;
    /**
     * `mirror` centers the bars on the middle line, `bars` stands them on the
     * baseline, and `line` joins the levels into one continuous, centered
     * shape. `scope` traces raw samples, -1…1, as a single line.
     * @default "mirror"
     */
    variant?: WaveformVariant;
  }
}
