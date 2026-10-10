import { Meter as BaseMeter } from "@base-ui/react/meter";
import type * as React from "react";
import { resolveStyling } from "../../internal/part";
import {
  channelDataAttributes,
  useChannelIndex,
  useChannelPart,
  useMergedRef,
} from "../internal/channel";
import { indicatorStyle } from "../internal/shared";
import type { Channel } from "./channel";

/** The lit part of the channel, scaled to the level. Renders a `<div>` element. */
export function Indicator(componentProps: Indicator.Props) {
  const { className, ref, style, ...props } = componentProps;
  const index = useChannelIndex("Indicator");
  const { partState, registerRef, view } = useChannelPart(
    "Indicator",
    index,
    "indicator"
  );
  const mergedRef = useMergedRef(ref, registerRef);
  const resolved = resolveStyling(className, style, partState);
  return (
    <BaseMeter.Indicator
      aria-hidden="true"
      {...channelDataAttributes(partState)}
      {...props}
      className={resolved.className}
      ref={mergedRef}
      style={{
        ...indicatorStyle(partState.orientation, view.percent),
        ...resolved.style,
      }}
    />
  );
}

export namespace Indicator {
  export type State = Channel.State;
  export interface Props
    extends Omit<BaseMeter.Indicator.Props, "className" | "style"> {
    className?: string | ((state: State) => string | undefined);
    ref?: React.Ref<HTMLDivElement>;
    style?:
      | React.CSSProperties
      | ((state: State) => React.CSSProperties | undefined);
  }
}
