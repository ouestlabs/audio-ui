import { timeline } from "@audio-ui/primitives/timeline";
import { createParts } from "@ui-sdk/svelte/primitive";

/** Which element each part is. */
export const parts = createParts(timeline, {
  clip: "div",
  clipFadeIn: "svg",
  clipFadeInHandle: "div",
  clipFadeInInput: "input",
  clipFadeOut: "svg",
  clipFadeOutHandle: "div",
  clipFadeOutInput: "input",
  clipHeader: "div",
  clipInput: "input",
  clipTrimEnd: "div",
  clipTrimEndInput: "input",
  clipTrimStart: "div",
  clipTrimStartInput: "input",
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
