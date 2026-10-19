import type { Param } from "../audio/engine.ts";

/** A control of the panel that moves a number: every parameter of the voice, and the volume. */
export type Knobbed = Param | "volume";
export type OnParam = (param: Knobbed, value: number) => void;

/** What the LCD calls each control it reads out. */
export const NAMES: Record<Knobbed, string> = {
  attack: "Attack",
  contour: "Contour",
  cutoff: "Cutoff",
  decay: "Decay",
  depth: "Depth",
  glide: "Glide",
  noise: "Noise",
  osc: "Osc",
  rate: "Rate",
  release: "Release",
  resonance: "Resonance",
  sub: "Sub",
  sustain: "Sustain",
  tune: "Tune",
  volume: "Volume",
  width: "Width",
};
