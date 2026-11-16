import { envelope } from "@audio-ui/primitives/envelope";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(envelope, {
  fill: "svg",
  graph: "div",
  line: "svg",
  point: "div",
  root: "div",
  segment: "div",
});
