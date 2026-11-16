import { waveform } from "@audio-ui/primitives/waveform";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(waveform, {
  bar: "span",
  bars: "div",
  canvas: "canvas",
  control: "div",
  hover: "div",
  input: "input",
  marker: "div",
  playhead: "div",
  region: "div",
  regionEnd: "div",
  regionEndInput: "input",
  regionStart: "div",
  regionStartInput: "input",
  root: "div",
  thumb: "div",
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
