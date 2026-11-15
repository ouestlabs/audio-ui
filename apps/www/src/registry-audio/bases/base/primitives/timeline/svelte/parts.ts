import { timeline } from "@audio-ui/primitives/timeline";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(timeline, {
  lane: "div",
  mark: "div",
  playhead: "div",
  root: "div",
  ruler: "div",
  rulerInput: "input",
  track: "div",
  trackHeader: "div",
  trackResizeHandle: "div",
  trackResizeInput: "input",
  viewport: "div",
});
