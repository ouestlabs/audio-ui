import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { type PlotState, positionOn, usePlotContext } from "../context.js";

/**
 * A straight line across the plot at a value: vertical at an x value, such as
 * a filter's cutoff, or horizontal at a y value, such as 0 dB. Sits in
 * `Plot.Graph`. Renders a `<line>` element.
 */
export function Line(componentProps: Line.Props) {
  const { axis, className, ref, render, style, value, ...elementProps } =
    componentProps;
  const { meta, state } = usePlotContext("Line");
  const at =
    axis === "x" ? positionOn(meta.x, value) : 1 - positionOn(meta.y, value);
  const ends =
    axis === "x"
      ? { x1: at, x2: at, y1: 0, y2: 1 }
      : { x1: 0, x2: 1, y1: at, y2: at };
  return useRender({
    defaultTagName: "line",
    props: mergeProps<"line">(
      { ...ends, vectorEffect: "non-scaling-stroke" },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Line {
  export type State = PlotState;
  export interface Props extends PartProps<"line", State> {
    /** `"x"` draws a vertical line at an x value, `"y"` a horizontal one at a y value. */
    axis: "x" | "y";
    value: number;
  }
}
