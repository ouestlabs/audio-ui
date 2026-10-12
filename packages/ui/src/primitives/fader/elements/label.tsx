import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { FADER_STATE_ATTRIBUTES, useFaderContext } from "../context.js";
import type { Root } from "./root.js";

/** Accessible label, associated with the thumb. Renders a `<div>` element. */
export function Label(componentProps: Label.Props) {
  const {
    className,
    id: idProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { setLabelId, state } = useFaderContext("Label");
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  React.useLayoutEffect(() => {
    setLabelId(id);
    return () => setLabelId(undefined);
  }, [id, setLabelId]);
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { id },
      elementProps,
      resolveStyling(className, style, state)
    ),
    ref,
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });
}

export namespace Label {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
