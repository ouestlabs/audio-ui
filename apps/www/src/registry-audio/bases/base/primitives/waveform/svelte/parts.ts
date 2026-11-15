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
