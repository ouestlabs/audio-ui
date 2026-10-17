import { curvePath } from "@audio-ui/core/plot";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { type PlotState, usePlotContext } from "../context.ts";

/** The points the curve starts from: enough for a smooth curve at any size the plot is drawn, before it adds more at the tight bends. */
const DEFAULT_SAMPLES = 256;

/**
 * A curve across the whole plot: `y = fn(x)` in the axes' units, such as an
 * equalizer's response in dB at each frequency. With `fillTo`, it closes down
 * to that y value, to be filled as an area. Sits in `Plot.Graph`.
 * Renders a `<path>` element.
 */
export function Curve(componentProps: Curve.Props) {
  const {
    className,
    fillTo,
    fn,
    ref,
    render,
    samples = DEFAULT_SAMPLES,
    style,
    ...elementProps
  } = componentProps;
  const { meta, state } = usePlotContext("Curve");
  return useRender({
    defaultTagName: "path",
    props: mergeProps<"path">(
      {
        d: curvePath(fn, meta.x, meta.y, samples, fillTo),
        vectorEffect: "non-scaling-stroke",
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Curve {
  export type State = PlotState;
  export interface Props extends Omit<PartProps<"path", State>, "d"> {
    /** Closes the curve to this y value, so it can be filled as an area. */
    fillTo?: number;
    /** The curve: y, in the y axis' units, at each x. */
    fn: (x: number) => number;
    /** How many points it starts from, evenly along the x axis. It adds more where the curve bends tighter than that shows, such as a corner or a knee. @default 256 */
    samples?: number;
  }
}
