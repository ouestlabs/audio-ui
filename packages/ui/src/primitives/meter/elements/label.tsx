import * as React from "react";
import type { PartProps } from "../../internal/part.js";
import { resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { ChannelLabelContext } from "../context.js";

const NO_STATE: Label.State = {};

/** Accessible label of the channel it is in. Renders a `<span>` element. */
export function Label(componentProps: Label.Props) {
  const {
    className,
    id: idProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const setLabelId = React.use(ChannelLabelContext);
  if (!setLabelId) {
    throw new Error("Meter.Label must be used within Meter.Channel");
  }
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  React.useLayoutEffect(() => {
    setLabelId(id);
    return () => setLabelId(undefined);
  }, [id, setLabelId]);
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { id, role: "presentation" },
      elementProps,
      resolveStyling(className, style, NO_STATE)
    ),
    ref,
    render,
    state: NO_STATE,
  });
}

export namespace Label {
  export type State = Record<string, never>;
  export type Props = PartProps<"span", State>;
}
