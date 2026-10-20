import type { Settings } from "../audio/engine";

/** What the panel's controls call when they move: a drawbar's level, a switch's stop, a knob's value. */
export type OnDrawbar = (index: number, level: number) => void;
export type OnKnob = (
  knob: "click" | "drive" | "volume",
  value: number
) => void;
export type OnSwitch = <
  K extends "decay" | "harmonic" | "leslie" | "percussion",
>(
  key: K,
  value: Settings[K]
) => void;

/** The color of each drawbar's cap, as on the organ it follows: brown for the sub-octave and the fifth, black for the other fifths and thirds, white for the octaves. */
export const CAPS = [
  "brown",
  "brown",
  "white",
  "white",
  "black",
  "white",
  "black",
  "black",
  "white",
] as const;
