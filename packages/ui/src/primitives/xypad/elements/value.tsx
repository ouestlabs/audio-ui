import type * as React from "react";
import type { Point } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useXYPadContext } from "../context";
import { STATE_ATTRIBUTES_MAPPING } from "../internal/shared";
import type { Root } from "./root";

/**
 * The formatted value (`format`/`locale` on Root), `"x, y"` by default.
 * Renders an `<output>` element.
 */
export function Value(componentProps: Value.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state } = useXYPadContext("Value");
  const formattedX = meta.formatter.format(state.value.x);
  const formattedY = meta.formatter.format(state.value.y);
  return useRender({
    defaultTagName: "output",
    props: mergeProps<"output">(
      {
        "aria-live": "off",
        children:
          typeof children === "function"
            ? children(formattedX, formattedY, state.value)
            : (children ?? meta.formatPair(state.value.x, state.value.y)),
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Value {
  export type State = Root.State;
  export interface Props extends Omit<PartProps<"output", State>, "children"> {
    children?:
      | React.ReactNode
      | ((
          formattedX: string,
          formattedY: string,
          value: Point
        ) => React.ReactNode);
  }
}
