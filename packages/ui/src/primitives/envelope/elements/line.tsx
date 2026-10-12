import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context";
import { polylinePoints } from "../internal/geometry";
import type { Root } from "./root";

/** The envelope curve through the points. Renders a `<polyline>` element. */
export function Line(componentProps: Line.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useEnvelopeContext("Line");
  return useRender({
    defaultTagName: "polyline",
    props: mergeProps<"polyline">(
      {
        fill: "none",
        points: polylinePoints(state.value),
        style: { vectorEffect: "non-scaling-stroke" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Line {
  export type State = Root.State;
  export type Props = PartProps<"polyline", State>;
}
