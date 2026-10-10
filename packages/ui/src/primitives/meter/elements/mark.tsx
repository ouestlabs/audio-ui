import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { clampUnit } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useMeterContext } from "../context";

/**
 * A graduation of the level scale at `value`, such as -18 dB: placed along
 * the meter's length from its minimum, upward for a vertical meter and
 * rightward for a horizontal one. Sits directly in `Meter.Root`, beside the
 * channels. Decorative: each channel announces its own level. Put your own
 * tick and label inside it. Renders a `<div>` element.
 */
export function Mark(componentProps: Mark.Props) {
  const { className, ref, render, style, value, ...elementProps } =
    componentProps;
  const { meta, state } = useMeterContext("Mark");
  const { max, min } = meta.config;
  const share = clampUnit((value - min) / (max - min || 1)) * 100;
  const markState = React.useMemo<Mark.State>(
    () => ({ orientation: state.orientation }),
    [state.orientation]
  );
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          position: "absolute",
          ...(state.orientation === "vertical"
            ? { bottom: `${share}%` }
            : { insetInlineStart: `${share}%` }),
        },
      },
      { ...elementProps, ...resolveStyling(className, style, markState) }
    ),
    ref,
    render,
    state: markState,
  });
}

export namespace Mark {
  export type State = { orientation: "horizontal" | "vertical" };
  export interface Props extends PartProps<"div", State> {
    /** Where the mark sits, between `min` and `max`. */
    value: number;
  }
}
