import type { Param } from "../audio/engine";

/** A knob of the panel: the voice's five, the tempo and the volume. */
export type Knobbed = Param | "tempo" | "volume";
export type OnParam = (param: Knobbed, value: number) => void;

/** What the LCD calls each control it reads out. */
export const NAMES: Record<Knobbed, string> = {
  accent: "Accent",
  cutoff: "Cutoff",
  decay: "Decay",
  envmod: "Env mod",
  resonance: "Resonance",
  tempo: "Tempo",
  volume: "Volume",
};
