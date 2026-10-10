import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { type PartProps, resolveStyling } from "../../internal/part";
import {
  channelDataAttributes,
  useChannelIndex,
  useChannelPart,
} from "../internal/channel";
import type { Channel } from "./channel";

/**
 * The peak-hold mark, positioned at the channel's peak level; hidden while
 * the channel has none. Renders a `<div>` element.
 */
export function Peak(componentProps: Peak.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const index = useChannelIndex("Peak");
  const { partState, registerRef, view } = useChannelPart(
    "Peak",
    index,
    "peak"
  );
  const position = `${(view.peakPercent ?? 0) * 100}%`;
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-hidden": true,
        hidden: view.peakPercent === undefined,
        style:
          partState.orientation === "horizontal"
            ? { left: position }
            : { bottom: position },
        ...channelDataAttributes(partState),
      },
      { ...elementProps, ...resolveStyling(className, style, partState) }
    ),
    ref: ref ? [ref, registerRef] : registerRef,
    render,
  });
}

export namespace Peak {
  export type State = Channel.State;
  export type Props = PartProps<"div", State>;
}
