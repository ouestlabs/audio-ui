import { createParts } from "@ui-sdk/svelte/primitive";
import { pad } from "@/primitives/pad";

/** Which element each part is. */
export const parts = createParts(pad, { item: "button", root: "div" });
