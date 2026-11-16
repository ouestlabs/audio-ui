import { meter } from "@audio-ui/primitives/meter";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(meter, {
  channel: "div",
  indicator: "div",
  label: "span",
  mark: "div",
  peak: "div",
  root: "div",
  track: "div",
  value: "span",
});
