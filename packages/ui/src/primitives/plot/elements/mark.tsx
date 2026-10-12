import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { type PlotState, positionOn, usePlotContext } from "../context.js";

/**
 * A label at a value on one axis, such as "1k" under a frequency or "+12" by
 * a gain: placed at the value along the axis and left to you to set apart
 * from the plot's edge. Hidden from assistive technology, which reads the
 * handles' own values. Renders a `<div>` element.
 */
export function Mark(componentProps: Mark.Props) {
  const { axis, className, ref, render, style, value, ...elementProps } =
    componentProps;
  const { meta, state } = usePlotContext("Mark");
  const along =
    axis === "x"
      ? { left: `${positionOn(meta.x, value) * 100}%` }
      : { top: `${(1 - positionOn(meta.y, value)) * 100}%` };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: { ...along, pointerEvents: "none", position: "absolute" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state: { ...state, axis },
  });
}

export namespace Mark {
  export type State = PlotState & { axis: "x" | "y" };
  export interface Props extends PartProps<"div", PlotState> {
    /** The axis `value` is on: `"x"` places it across, `"y"` down. */
    axis: "x" | "y";
    value: number;
  }
}
