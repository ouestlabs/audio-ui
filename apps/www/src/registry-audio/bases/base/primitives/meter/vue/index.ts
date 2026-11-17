import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";
import { type ChannelPublicState, meter } from "@/primitives/meter";

/** Which element each part is. */
const parts = createParts(meter, {
  channel: "div",
  indicator: "div",
  label: "span",
  mark: "div",
  peak: "div",
  root: "div",
  track: "div",
  value: "span",
});

const Value = defineComponent(
  (_props, { attrs, slots }) =>
    () =>
      h(parts.Value, attrs, {
        default:
          slots.default ??
          (({ state }: { state: ChannelPublicState }) => state.text),
      }),
  { inheritAttrs: false, name: "MeterValue" }
);

/**
 * The channels are written by the app, one per level: the Root's default
 * slot gets its state, `{ channelCount, orientation }`, for a count that
 * follows a live source.
 */
export const Meter = {
  Channel: parts.Channel,
  Indicator: parts.Indicator,
  Label: parts.Label,
  Mark: parts.Mark,
  Peak: parts.Peak,
  Root: parts.Root,
  Track: parts.Track,
  Value,
};
