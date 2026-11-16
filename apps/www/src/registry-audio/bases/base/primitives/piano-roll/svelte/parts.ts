import { pianoRoll } from "@audio-ui/primitives/piano-roll";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(pianoRoll, {
  grid: "div",
  keys: "div",
  marquee: "div",
  note: "div",
  noteEnd: "div",
  noteStart: "div",
  notes: "div",
  root: "div",
  row: "div",
  rows: "div",
  selectionSpan: "div",
  stretchEnd: "div",
  stretchStart: "div",
  velocity: "div",
  velocityInput: "input",
  velocityLane: "div",
});
