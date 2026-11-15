import { xypad } from "@audio-ui/primitives/xypad";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(xypad, {
  control: "div",
  inputX: "input",
  inputY: "input",
  label: "div",
  root: "div",
  thumb: "div",
  value: "output",
});
