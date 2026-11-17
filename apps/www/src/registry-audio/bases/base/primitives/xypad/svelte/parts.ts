import { createParts } from "@ui-sdk/svelte/primitive";
import { xypad } from "@/primitives/xypad";

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
