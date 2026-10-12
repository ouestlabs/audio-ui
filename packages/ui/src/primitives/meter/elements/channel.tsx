import * as React from "react";
import type { PartProps } from "../../internal/part.js";
import { resolveStyling } from "../../internal/part.js";
import { mergeProps, useRender } from "../../internal/render.js";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.js";
import { ChannelIndexContext, ChannelLabelContext } from "../context.js";
import { useChannelPart, useMergedRef } from "../internal/channel.js";
import type { Root } from "./root.js";

/** The index is the channel's identity, not a presence to style by. */
export const CHANNEL_STATE_ATTRIBUTES = { index: () => null };

/**
 * One channel of the meter, a `role="meter"`: name it with `aria-label` or a
 * `Meter.Label`. Carries `data-warning` from the warning level up to the clip threshold, and `data-clipping` at or above it. Fed by a live `source`, it also carries `data-clipped` from the first clip until a click on the meter clears it.
 * Renders a `<div>` element.
 */
export function Channel(componentProps: Channel.Props) {
  const {
    children,
    className,
    getAriaValueText,
    index,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, config, partState, registerRef, view } = useChannelPart(
    "Channel",
    index,
    "channel"
  );
  // Kept current for the live source, which builds the value text outside React.
  actions.setAriaValueTextGetter(index, getAriaValueText);
  const mergedRef = useMergedRef(ref, registerRef);
  const [labelId, setLabelId] = React.useState<string | undefined>();
  const valueNow = Math.min(config.max, Math.max(config.min, view.valueNow));

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        "aria-labelledby": labelId,
        "aria-valuemax": config.max,
        "aria-valuemin": config.min,
        "aria-valuenow": valueNow,
        "aria-valuetext":
          getAriaValueText?.(view.text, view.valueNow, index) ?? view.text,
        children: (
          <>
            {children}
            {/* A meter with no text inside is skipped by some screen readers. */}
            <span role="presentation" style={VISUALLY_HIDDEN}>
              x
            </span>
          </>
        ),
        role: "meter",
      },
      elementProps,
      resolveStyling(className, style, partState)
    ),
    ref: mergedRef,
    render,
    state: partState,
    stateAttributesMapping: CHANNEL_STATE_ATTRIBUTES,
  });

  return (
    <ChannelIndexContext value={index}>
      <ChannelLabelContext value={setLabelId}>{element}</ChannelLabelContext>
    </ChannelIndexContext>
  );
}

export namespace Channel {
  export type State = Root.State & {
    /** Whether the level is at or above the clip threshold. */
    clipping: boolean;
    index: number;
    /** Whether the level is at or above the warning level, below the clip threshold. */
    warning: boolean;
  };
  export interface Props extends PartProps<"div", State> {
    /** Returns the channel's `aria-valuetext`, e.g. `"-6 dB"`. Defaults to the formatted level. */
    getAriaValueText?: (
      formattedValue: string,
      value: number,
      index: number
    ) => string;
    /** Index of the channel in the levels. */
    index: number;
  }
}
