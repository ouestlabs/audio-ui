import type { Param } from "../audio/engine";

/** A knob of the panel: the voice's and the echo's six, and the volume. */
export type Knobbed = Param | "volume";
export type OnParam = (param: Knobbed, value: number) => void;
