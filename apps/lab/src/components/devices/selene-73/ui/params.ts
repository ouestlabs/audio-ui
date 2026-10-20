import type { Param } from "../audio/engine";

/** A control of the panel that moves a number: the voice's five, and the volume. */
export type Knobbed = Param | "volume";
export type OnParam = (param: Knobbed, value: number) => void;

/** What the screen calls each control it reads out. */
export const NAMES: Record<Knobbed, string> = {
  bark: "Bark",
  bell: "Bell",
  decay: "Decay",
  depth: "Trem depth",
  drive: "Drive",
  rate: "Trem rate",
  volume: "Volume",
};
