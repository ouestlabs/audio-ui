import { pad } from "@audio-ui/primitives/pad";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(pad, { item: "button", root: "div" });
