import type * as React from "react";
import type { PartProps } from "../../internal/part.js";
import { resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import {
  useChannelIndex,
  useChannelPart,
  useMergedRef,
} from "../internal/channel.js";

const NO_STATE: Value.State = {};

/**
 * The channel's formatted level (`format`/`locale` on Root). With a live
 * `source` only the default text is kept current, not a `children` function.
 * Renders a `<span>` element.
 */
export function Value(componentProps: Value.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const index = useChannelIndex("Value");
  const { registerRef, view } = useChannelPart("Value", index, "value");
  const mergedRef = useMergedRef(ref, registerRef);
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        "aria-hidden": true,
        children:
          typeof children === "function"
            ? children(view.text, view.valueNow)
            : view.text,
      },
      elementProps,
      resolveStyling(className, style, NO_STATE)
    ),
    ref: mergedRef,
    render,
    state: NO_STATE,
  });
}

export namespace Value {
  export type State = Record<string, never>;
  export interface Props extends Omit<PartProps<"span", State>, "children"> {
    /** Renders the level from its formatted text and its number; defaults to the text. */
    children?:
      | ((formattedValue: string, value: number) => React.ReactNode)
      | null;
  }
}
