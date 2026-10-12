import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { type PlotState, usePlotContext } from "../context.ts";

/**
 * The drawing surface: an `<svg>` covering the plot, stretched to its size,
 * that `Plot.Curve`, `Plot.Line` and `Plot.Band` draw in. Strokes keep their
 * width however the plot is stretched. Hidden from assistive technology and
 * from the pointer. Renders an `<svg>` element.
 */
export function Graph(componentProps: Graph.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = usePlotContext("Graph");
  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(
      {
        "aria-hidden": true,
        preserveAspectRatio: "none",
        style: {
          height: "100%",
          inset: 0,
          overflow: "visible",
          pointerEvents: "none",
          position: "absolute",
          width: "100%",
        },
        viewBox: "0 0 1 1",
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Graph {
  export type State = PlotState;
  export type Props = PartProps<"svg", State>;
}
