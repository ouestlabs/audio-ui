import type * as React from "react";
import { clamp } from "../../../utils";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { FADER_STATE_ATTRIBUTES, useFaderContext } from "../context";
import type { Root } from "./root";

/**
 * The filled part of the track: from `min` up to the value, or between the
 * Root's `anchor` and the value, on whichever side of it the value is.
 * Renders a `<div>` element.
 */
export function Indicator(componentProps: Indicator.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { anchor, max, min, orientation, state, value } =
    useFaderContext("Indicator");
  const share = (at: number) =>
    clamp(((at - min) / (max - min || 1)) * 100, 0, 100);
  const from = share(Math.min(anchor ?? min, value));
  const to = share(Math.max(anchor ?? min, value));
  const placed: React.CSSProperties =
    orientation === "vertical"
      ? { bottom: `${from}%`, height: `${to - from}%`, width: "inherit" }
      : {
          height: "inherit",
          insetInlineStart: `${from}%`,
          width: `${to - from}%`,
        };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: placed },
      elementProps,
      resolveStyling(className, style, state)
    ),
    ref,
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });
}

export namespace Indicator {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
