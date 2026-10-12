import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { FADER_STATE_ATTRIBUTES, useFaderContext } from "../context.js";
import type { Root } from "./root.js";

/** The full range of travel. Renders a `<div>` element. */
export function Track(componentProps: Track.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = useFaderContext("Track");
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: { position: "relative" } },
      elementProps,
      resolveStyling(className, style, state)
    ),
    ref,
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });
}

export namespace Track {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
