import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useKnobContext } from "../context";
import { STATE_ATTRIBUTES_MAPPING } from "../internal/shared";
import type { Root } from "./root";

/** Accessible label, associated with the thumb's input. Renders a `<div>` element. */
export function Label(componentProps: Label.Props) {
  const {
    className,
    id: idProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { meta, state } = useKnobContext("Label");
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const { setLabelId } = meta;
  React.useEffect(() => {
    setLabelId(id);
    return () => setLabelId(undefined);
  }, [id, setLabelId]);
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { id },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Label {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
