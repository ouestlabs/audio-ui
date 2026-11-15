import { piano } from "@audio-ui/primitives/piano";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(piano, {
  key: "button",
  label: "span",
  root: "div",
});
