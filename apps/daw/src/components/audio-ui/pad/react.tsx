import { pad } from "@audio-ui/primitives/pad";
import { createParts } from "@ui-sdk/react/primitive";

/** Which element each part is. */
const parts = createParts(pad, { item: "button", root: "div" });

export const Pad = { Item: parts.Item, Root: parts.Root };