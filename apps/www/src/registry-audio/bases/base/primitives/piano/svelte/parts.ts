import { createParts } from "@ui-sdk/svelte/primitive";
import { piano } from "@/primitives/piano";

/** Which element each part is. */
export const parts = createParts(piano, {
  key: "button",
  label: "span",
  root: "div",
});
