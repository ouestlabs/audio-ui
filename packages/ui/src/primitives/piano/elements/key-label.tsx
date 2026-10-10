import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { pitchName } from "../../internal/pitch";
import { KeyContext, usePianoContext } from "../context";

/**
 * The name of the key it sits in, such as "C4". Hidden from assistive
 * technology, which reads the key's own name. Renders a `<span>` element.
 */
export function KeyLabel(componentProps: KeyLabel.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { state } = usePianoContext("KeyLabel");
  const pitch = React.use(KeyContext);
  if (pitch === null) {
    throw new Error("Piano.KeyLabel must be used within Piano.Key");
  }
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { "aria-hidden": true, children: pitchName(pitch) },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace KeyLabel {
  export type State = import("../context").PianoState;
  export type Props = PartProps<"span", State>;
}
