import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type PartProps, resolveStyling } from "../../internal/part";
import { STATE_ATTRIBUTES_MAPPING, useEnvelopeContext } from "../context";
import { polylinePoints } from "../internal/geometry";
import type { Root } from "./root";

/** The area under the curve. Renders a `<polyline>` element. */
export function Fill(componentProps: Fill.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useEnvelopeContext("Fill");
  const points = polylinePoints(state.value);
  return useRender({
    defaultTagName: "polyline",
    props: mergeProps<"polyline">(
      { points: points ? `${points} 100,100 0,100` : "" },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Fill {
  export type State = Root.State;
  export type Props = PartProps<"polyline", State>;
}
