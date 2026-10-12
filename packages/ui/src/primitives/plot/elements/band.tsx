import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { type PlotState, positionOn, usePlotContext } from "../context";

/**
 * A stretch of the plot between two values on one axis, across the whole of
 * the other: the frequencies a sweep can reach, the levels over a threshold.
 * Sits in `Plot.Graph`. Renders a `<rect>` element.
 */
export function Band(componentProps: Band.Props) {
  const { axis, className, from, ref, render, style, to, ...elementProps } =
    componentProps;
  const { meta, state } = usePlotContext("Band");
  const along = axis === "x" ? meta.x : meta.y;
  const start = round(positionOn(along, Math.min(from, to)));
  const end = round(positionOn(along, Math.max(from, to)));
  const box =
    axis === "x"
      ? { height: 1, width: round(end - start), x: start, y: 0 }
      : { height: round(end - start), width: 1, x: 0, y: round(1 - end) };
  return useRender({
    defaultTagName: "rect",
    props: mergeProps<"rect">(box, {
      ...elementProps,
      ...resolveStyling(className, style, state),
    }),
    ref,
    render,
    state,
  });
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

export namespace Band {
  export type State = PlotState;
  export interface Props extends PartProps<"rect", State> {
    /** The axis `from` and `to` are values on. */
    axis: "x" | "y";
    from: number;
    to: number;
  }
}
