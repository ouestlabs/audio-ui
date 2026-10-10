import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { clamp } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useFaderContext } from "../context";

/**
 * A graduation along the track at `value`: placed from the start of the
 * travel in the fader's direction, where the thumb's center would be at that
 * value. It carries `data-active` while the value has reached it from the
 * anchor, and `data-orientation`. Decorative: the thumb's input announces the
 * value. Render your own tick and label inside it. Renders a `<div>` element.
 */
export function Mark(componentProps: Mark.Props) {
  const { className, ref, render, style, value, ...elementProps } =
    componentProps;
  const context = useFaderContext("Mark");
  const { anchor, disabled, max, min, orientation } = context;
  const share = clamp(((value - min) / (max - min || 1)) * 100, 0, 100);
  const from = anchor ?? min;
  const active =
    value >= Math.min(from, context.value) &&
    value <= Math.max(from, context.value);
  const state = React.useMemo<Mark.State>(
    () => ({ active, disabled, orientation }),
    [active, disabled, orientation]
  );
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          position: "absolute",
          ...(orientation === "vertical"
            ? { bottom: `${share}%` }
            : { insetInlineStart: `${share}%` }),
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Mark {
  export type State = {
    /** Whether the value has reached this mark from the anchor. */
    active: boolean;
    disabled: boolean;
    orientation: "horizontal" | "vertical";
  };
  export interface Props extends PartProps<"div", State> {
    /** Where the mark sits, between `min` and `max`. */
    value: number;
  }
}
