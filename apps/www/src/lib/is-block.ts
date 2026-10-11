/** A block is laid out for a page, not a card: its preview is as tall as it is. */
export const isBlock = (name: string) => name.startsWith("block-");

/**
 * The previews that can be opened at full size: the editors made to take a
 * whole screen. A block that fits a card does not need it.
 */
const EXPANDABLE = new Set(["block-piano-roll"]);

export const isExpandable = (name: string) => EXPANDABLE.has(name);
