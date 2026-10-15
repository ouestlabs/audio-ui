/** A block is laid out for a page, not a card: its preview is as tall as it is. */
export const isBlock = (name: string) => name.startsWith("block-");

/**
 * The previews that can be opened at full size: the editors made to take a
 * whole screen, and the plots, which are all the better for the room. A block
 * that fits a card does not need it.
 */
const EXPANDABLE = new Set([
  "block-piano-roll",
  "block-timeline",
  "plot-compressor-demo",
  "plot-demo",
  "plot-filter-demo",
]);

export const isExpandable = (name: string) => EXPANDABLE.has(name);

/** The previews that play from a keyboard: their bar gets a button to connect a MIDI one. */
const MIDI = new Set([
  "block-piano-roll",
  "piano-size-default-demo",
  "spectrum-analyzer-demo",
]);

export const takesMidi = (name: string) => MIDI.has(name);
