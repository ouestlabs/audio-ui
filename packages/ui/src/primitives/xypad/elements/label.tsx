import { STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/xypad";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { useXYPadContext } from "../context.js";
import type { Root } from "./root.js";

/** Accessible label, associated with both axis inputs. Renders a `<div>` element. */
export function Label(componentProps: Label.Props) {
  const {
    className,
    id: idProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { setLabelId, state } = useXYPadContext("Label");
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
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
