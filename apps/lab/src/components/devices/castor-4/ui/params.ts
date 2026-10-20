import type { Param } from "../audio/engine";

/** A control of the panel that moves a number: every parameter of the machine, and the volume. */
export type Knobbed = Param | "volume";
export type OnParam = (param: Knobbed, value: number) => void;

/** What the screen calls each control it reads out. */
export const NAMES: Record<Knobbed, string> = {
  attack: "Attack",
  bass: "Bass",
  bright: "Brightness",
  cello: "Cello",
  ensemble: "Ensemble",
  release: "Release",
  viola: "Viola",
  violin: "Violin",
  volume: "Volume",
};
