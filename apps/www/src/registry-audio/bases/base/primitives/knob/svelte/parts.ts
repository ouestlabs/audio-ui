import { createParts } from "@ui-sdk/svelte/primitive";
import type { KnobPrimitiveOptions } from "@/primitives/knob";
import { knob } from "@/primitives/knob";

/** Which element each part is. */
export const parts = createParts(knob, {
  control: "div",
  indicator: "svg",
  input: "input",
  label: "div",
  mark: "div",
  root: "div",
  thumb: "div",
  track: "svg",
  value: "output",
});

/** What a provider gives every knob below it. UI SDK has no such thing. */
export type Defaults = Pick<KnobPrimitiveOptions, "dragMode">;
export const DEFAULTS = Symbol("knob defaults");
