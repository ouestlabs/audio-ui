import { plot } from "@audio-ui/primitives/plot";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(plot, {
  band: "svg",
  curve: "svg",
  cursor: "div",
  cursorReadout: "div",
  dot: "div",
  grid: "div",
  handle: "div",
  inputX: "input",
  inputY: "input",
  line: "svg",
  mark: "div",
  root: "div",
  trace: "svg",
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
