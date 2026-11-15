import { sequencer } from "@audio-ui/primitives/sequencer";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(sequencer, {
  cell: "button",
  root: "div",
  row: "div",
  velocity: "div",
  velocityInput: "input",
});
