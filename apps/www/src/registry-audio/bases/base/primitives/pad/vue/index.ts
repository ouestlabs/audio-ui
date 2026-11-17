import { createParts } from "@ui-sdk/vue/primitive";
import { pad } from "@/primitives/pad";

/** Which element each part is. */
const parts = createParts(pad, { item: "button", root: "div" });

export const Pad = { Item: parts.Item, Root: parts.Root };
