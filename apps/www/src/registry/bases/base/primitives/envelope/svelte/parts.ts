import { createParts } from "@ui-sdk/svelte/primitive";
import { envelope } from "@/primitives/envelope";

/** Which element each part is. */
export const parts = createParts(envelope, {
  fill: "svg",
  graph: "div",
  line: "svg",
  point: "div",
  root: "div",
  segment: "div",
});
