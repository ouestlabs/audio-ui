import type { Point } from "@audio-ui/core";
import { STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/xypad";
import type * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useXYPadContext } from "../context.ts";
import type { Root } from "./root.tsx";

/**
 * The formatted value (`format`/`locale` on Root), `"x, y"` by default.
 * Renders an `<output>` element.
 */
export function Value(componentProps: Value.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { snapshot, state } = useXYPadContext("Value");
  const formattedX = snapshot.formatted.x;
  const formattedY = snapshot.formatted.y;
  return useRender({
    defaultTagName: "output",
    props: mergeProps<"output">(
      {
        "aria-live": "off",
        children:
          typeof children === "function"
            ? children(formattedX, formattedY, state.value)
            : (children ?? snapshot.formattedPair),
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
