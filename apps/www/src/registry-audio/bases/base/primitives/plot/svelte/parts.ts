import { plot } from "@audio-ui/primitives/plot";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(plot, {
  band: "svg",
  curve: "svg",
  cursor: "div",
  cursorReadout: "div",
  dot: "div",
  grid: "div",
  handle: "div",
  inputX: "input",
  inputY: "input",
  line: "svg",
  mark: "div",
  root: "div",
  trace: "svg",
});
