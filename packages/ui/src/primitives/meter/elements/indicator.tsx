import type { PartProps } from "../../internal/part.ts";
import { resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  useChannelIndex,
  useChannelPart,
  useMergedRef,
} from "../internal/channel.ts";
import { indicatorStyle } from "../internal/shared.ts";
import { CHANNEL_STATE_ATTRIBUTES, type Channel } from "./channel.tsx";

/** The lit part of the channel, scaled to the level. Renders a `<div>` element. */
export function Indicator(componentProps: Indicator.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const index = useChannelIndex("Indicator");
  const { partState, registerRef, view } = useChannelPart(
    "Indicator",
    index,
    "indicator"
  );
  const mergedRef = useMergedRef(ref, registerRef);
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        style: {
          insetInlineStart: 0,
          ...indicatorStyle(partState.orientation, view.percent),
        },
      },
      elementProps,
      resolveStyling(className, style, partState)
    ),
    ref: mergedRef,
    render,
    state: partState,
    stateAttributesMapping: CHANNEL_STATE_ATTRIBUTES,
  });
}

export namespace Indicator {
  export type State = Channel.State;
  export type Props = PartProps<"div", State>;
}
