import type { Param } from "../audio/engine";

/** A knob of the panel: the engine's three, and the volume. */
export type Knobbed = Param | "volume";
export type OnParam = (param: Knobbed, value: number) => void;

/** What the LCD calls each control it reads out. */
export const NAMES: Record<Knobbed, string> = {
  cutoff: "Filter",
  pitch: "Pitch",
  release: "Release",
  volume: "Volume",
};

/** The first note of a MIDI keyboard or pads that plays a slice: pad 1 is note 36, as on drum pads. */
export const FIRST_NOTE = 36;
