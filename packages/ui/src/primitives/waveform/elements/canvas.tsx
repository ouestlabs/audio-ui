import {
  attachWaveformCanvas,
  type WaveformIdle,
  type WaveformVariant,
} from "@audio-ui/core/waveform";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useReducedMotion } from "../../internal/use-reduced-motion.ts";
import { useWaveformContext, type WaveformState } from "../context.ts";

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
    barGap,
    barRadius,
    barWidth,
    className,
    gain,
    idle,
    lineWidth,
    minBarHeight,
    mirrored,
    mode,
    ref,
    render,
    scrollSpeed,
    style,
    variant,
    ...elementProps
  } = componentProps;
  const { meta, state } = useWaveformContext("Canvas");
  const { duration, levels, peaks, position, range } = meta;
  const { loading } = state;
  const reducedMotion = useReducedMotion();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    return attachWaveformCanvas(canvas, {
      barGap,
      barRadius,
      barWidth,
      duration,
      gain,
      idle,
      levels,
      lineWidth,
      loading,
      minBarHeight,
      mirrored,
      mode,
      peaks,
      played: position,
      range,
      reducedMotion,
      scrollSpeed,
      variant,
    });
  }, [
    barGap,
    barRadius,
    barWidth,
    gain,
    idle,
    lineWidth,
    levels,
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
