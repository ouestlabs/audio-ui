import type { Param } from "../audio/engine";

/** A control of the panel that moves a number: every parameter of the voice, and the volume. */
export type Knobbed = Param | "volume";
export type OnParam = (param: Knobbed, value: number) => void;

/** What the LCD calls each control it reads out. */
export const NAMES: Record<Knobbed, string> = {
  attack: "Attack",
  contour: "Env amount",
  cutoff: "Cutoff",
  decay: "Decay",
  keys: "Key follow",
  noise: "Noise",
  pulse: "Pulse",
  rate: "LFO rate",
  release: "Release",
  resonance: "Resonance",
  saw: "Saw",
  sub: "Sub",
  sustain: "Sustain",
  vibrato: "Vibrato",
  volume: "Volume",
  width: "Width",
};
