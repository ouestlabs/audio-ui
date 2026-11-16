import { meter } from "@audio-ui/primitives/meter";
import { createParts } from "@ui-sdk/react/primitive";
import type { ComponentProps } from "react";

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

function Value({ children, ...props }: ComponentProps<typeof parts.Value>) {
  return (
    <parts.Value {...props}>{children ?? (({ text }) => text)}</parts.Value>
  );
}

/**
 * The channels are written by the app, one per level: the Root's children
 * can be a function of its state, `{ channelCount, orientation }`, for a
 * count that follows a live source.
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
