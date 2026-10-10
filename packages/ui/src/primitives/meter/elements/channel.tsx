import { Meter as BaseMeter } from "@base-ui/react/meter";
import * as React from "react";
import { resolveStyling } from "../../internal/part";
import { ChannelIndexContext } from "../context";
import {
  channelDataAttributes,
  useChannelPart,
  useMergedRef,
} from "../internal/channel";
import type { Root } from "./root";

/**
 * One channel of the meter, a `role="meter"`: name it with `aria-label` or a
 * `Meter.Label`. Carries `data-clipping` at or above the clip threshold. Fed by a live `source`, it also carries `data-clipped` from the first clip until a click on the meter clears it.
 * Renders a `<div>` element.
 */
export function Channel(componentProps: Channel.Props) {
  const { className, getAriaValueText, index, ref, style, ...props } =
    componentProps;
  const { actions, config, partState, registerRef, view } = useChannelPart(
    "Channel",
    index,
    "channel"
  );
  // Kept current for the live source, which builds the value text outside React.
  actions.setAriaValueTextGetter(index, getAriaValueText);
  const mergedRef = useMergedRef(ref, registerRef);
  const baseGetAriaValueText = React.useCallback(
    (formattedValue: string, value: number) =>
      getAriaValueText?.(formattedValue, value, index) ?? formattedValue,
    [getAriaValueText, index]
  );

  return (
    <ChannelIndexContext value={index}>
      <BaseMeter.Root
        {...channelDataAttributes(partState)}
        format={config.format}
        getAriaValueText={baseGetAriaValueText}
        locale={config.locale}
        max={config.max}
        min={config.min}
        value={view.valueNow}
        {...props}
        {...resolveStyling(className, style, partState)}
        ref={mergedRef}
      />
    </ChannelIndexContext>
  );
}

export namespace Channel {
  export type State = Root.State & {
    /** Whether the level is at or above the clip threshold. */
    clipping: boolean;
    index: number;
  };
  export interface Props
    extends Omit<
      BaseMeter.Root.Props,
      | "className"
      | "format"
      | "getAriaValueText"
      | "locale"
      | "max"
      | "min"
      | "style"
      | "value"
    > {
    className?: string | ((state: State) => string | undefined);
    /** Returns the channel's `aria-valuetext`, e.g. `"-6 dB"`. Defaults to the formatted level. */
    getAriaValueText?: (
      formattedValue: string,
      value: number,
      index: number
    ) => string;
    /** Index of the channel in the levels. */
    index: number;
    ref?: React.Ref<HTMLDivElement>;
    style?:
      | React.CSSProperties
      | ((state: State) => React.CSSProperties | undefined);
  }
}
