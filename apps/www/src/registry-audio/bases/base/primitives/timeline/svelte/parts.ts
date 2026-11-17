import { createParts } from "@ui-sdk/svelte/primitive";
import { timeline } from "@/primitives/timeline";

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
  navigator: "div",
  navigatorEnd: "div",
  navigatorEndInput: "input",
  navigatorStart: "div",
  navigatorStartInput: "input",
  navigatorWindow: "div",
  navigatorWindowInput: "input",
  range: "div",
  rangeEnd: "div",
  rangeEndInput: "input",
  rangeInput: "input",
  rangeStart: "div",
  rangeStartInput: "input",
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
