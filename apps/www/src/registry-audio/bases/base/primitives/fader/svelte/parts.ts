import { createParts } from "@ui-sdk/svelte/primitive";
import { fader } from "@/primitives/fader";

/** Which element each part is. */
export const parts = createParts(fader, {
  control: "div",
  indicator: "div",
  input: "input",
  label: "div",
  mark: "div",
  root: "div",
  thumb: "div",
  track: "div",
  value: "output",
});
