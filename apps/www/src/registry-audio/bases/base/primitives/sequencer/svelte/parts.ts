import { createParts } from "@ui-sdk/svelte/primitive";
import { sequencer } from "@/primitives/sequencer";

/** Which element each part is. */
export const parts = createParts(sequencer, {
  cell: "button",
  root: "div",
  row: "div",
  velocity: "div",
  velocityInput: "input",
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
