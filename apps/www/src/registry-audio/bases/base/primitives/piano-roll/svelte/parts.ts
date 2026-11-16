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

/** The props a part names, without the open index signature that would turn them into `unknown` under `Omit`. */
export type Known<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K]: T[K];
};
