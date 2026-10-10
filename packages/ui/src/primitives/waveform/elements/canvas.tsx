import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { clampUnit } from "../../../utils";
import { createFrameTask } from "../../internal/frame-task";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useReducedMotion } from "../../internal/use-reduced-motion";
import { observeVisibility } from "../../internal/visibility";
import { useWaveformContext, type WaveformState } from "../context";
import {
  type BarLayout,
  barLayout,
  barRect,
  bitmapLength,
  scrollShift,
  type WaveformVariant,
} from "../internal/bar-layout";
import {
  createLevelHistory,
  type LevelHistory,
} from "../internal/level-history";
import { loudest } from "../internal/levels";
import {
  createLevelsEngine,
  type LevelsEngine,
  type WaveformIdle,
} from "../internal/levels-engine";

const BAR_RADIUS_PROPERTY = "--waveform-bar-radius";
const THEME_ATTRIBUTES = ["class", "style", "data-theme"];
/** With reduced motion, a moving waveform repaints this often at most. */
const REDUCED_MOTION_INTERVAL_MS = 250;
const MS_PER_SECOND = 1000;

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

/** One rectangle per level. */
function barsPath(
  levels: Float32Array,
  layout: BarLayout,
  shift: number,
  radius: number
): Path2D {
  const path = new Path2D();
  for (let index = 0; index < levels.length; index += 1) {
    const bar = barRect(levels[index] ?? 0, index, layout, shift);
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

/** One closed shape: along the top of every level, then back along the bottoms. */
function linePath(
  levels: Float32Array,
  layout: BarLayout,
  shift: number
): Path2D {
  const path = new Path2D();
  for (let index = 0; index < levels.length; index += 1) {
    const bar = barRect(levels[index] ?? 0, index, layout, shift);
    path.lineTo(bar.x + bar.width / 2, bar.y);
  }
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    const bar = barRect(levels[index] ?? 0, index, layout, shift);
    path.lineTo(bar.x + bar.width / 2, bar.y + bar.height);
  }
  path.closePath();
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
 * the width and a scrolling record of the loudest one.
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
  const { levels: live, peaks, position } = meta;
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
    let shape = new Path2D();
    let radius = 0;
    let input = live ? live.getSnapshot() : peaks;
    // Whether the bars must be laid out again before the next paint.
    let stale = true;
    // Whether the levels may have moved since the shape was built.
    let moving = true;
    // A resize must repaint at once, whatever would otherwise wait.
    let urgent = false;
    let visible = true;
    let clock = 0;
    let unpaintedMs = 0;
    let sincePaintMs = Number.POSITIVE_INFINITY;

    const measure = () => {
      stale = false;
      const pixelRatio = window.devicePixelRatio || 1;
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
      if (live && mode === "scrolling") {
        // One entry more than fits: the newest slides in as the oldest slides out.
        const pitch = layout.pitch / pixelRatio;
        history = createLevelHistory(
          layout.count + 1,
          (pitch / Math.max(scrollSpeed, 1)) * MS_PER_SECOND,
          history?.levels
        );
      } else {
        engine = createLevelsEngine({
          count: layout.count,
          gain,
          idle,
          loading,
          minLevel: 0,
          mirrored,
          reducedMotion,
        });
      }
      moving = true;
    };

    /** Move the levels on by `elapsedMs` and rebuild the shape. Returns whether they are still moving. */
    const advance = (elapsedMs: number): boolean => {
      if (!layout) {
        return false;
      }
      clock += elapsedMs;
      let levels = engine?.levels;
      let shift = 0;
      let running = false;
      if (history) {
        running = history.step(elapsedMs);
        ({ levels } = history);
        shift = scrollShift(
          levels.length,
          reducedMotion ? 1 : history.progress,
          layout
        );
      } else if (engine) {
        engine.step(clock, input);
        running = !engine.settled;
      }
      if (levels) {
        shape =
          variant === "line"
            ? linePath(levels, layout, shift)
            : barsPath(levels, layout, shift, radius);
      }
      return running;
    };

    const fill = (color: string, from: number, to: number) => {
      if (to <= from) {
        return;
      }
      context.save();
      context.beginPath();
      context.rect(from, 0, to - from, canvas.height);
      context.clip();
      context.fillStyle = color;
      context.fill(shape);
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
      fill(progressColor, 0, played);
      fill(color, played, canvas.width);
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
      const width = bitmapLength(
        entry.contentRect.width,
        pixelRatio,
        exact?.inlineSize
      );
      const height = bitmapLength(
        entry.contentRect.height,
        pixelRatio,
        exact?.blockSize
      );
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
      history?.feed(clampUnit(loudest(input) * gain));
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
    live,
    loading,
    minBarHeight,
    mirrored,
    mode,
    peaks,
    position,
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
    /** Shortest bar, in CSS pixels: silence still draws a sliver, so the timeline stays readable. @default 2 */
    minBarHeight?: number;
    /** Mirrors the levels around the middle bar, the first one in the center, outside the scrolling mode. @default false */
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
     * baseline, and `line` joins the levels into one continuous, centered shape.
     * @default "mirror"
     */
    variant?: WaveformVariant;
  }
}
