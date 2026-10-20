import type { PadControl } from "../audio/engine";

/** A knob of the panel: the chosen pad's four, the tempo and the volume. */
export type Param = PadControl | "tempo" | "volume";
export type OnParam = (param: Param, value: number) => void;

/** What the screen calls each control it reads out. */
export const NAMES: Record<Param, string> = {
  decay: "Decay",
  level: "Level",
  pan: "Pan",
  tempo: "Tempo",
  tune: "Tune",
  volume: "Volume",
};
