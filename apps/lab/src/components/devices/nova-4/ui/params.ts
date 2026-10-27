import { type OperatorParam, type Param, ratioOf } from "../audio/engine";

/** A control of the panel that moves a number: every parameter of the voice, and the volume. */
export type Knobbed = Param | "volume";
export type OnParam = (param: Knobbed, value: number) => void;

const GLOBAL: Record<Exclude<Knobbed, `${OperatorParam}${number}`>, string> = {
  algorithm: "Algorithm",
  attack: "Attack",
  feedback: "Feedback",
  release: "Release",
  vibrato: "Vibrato",
  volume: "Volume",
};
const OPERATOR: Record<OperatorParam, string> = {
  decay: "Decay",
  level: "Level",
  ratio: "Ratio",
  sustain: "Sustain",
};

/** A ratio as the panel prints it: `x3.5`. */
export const ratioText = (index: number) => `x${ratioOf(index)}`;

/** What the LCD reads out for a control at a value: `Op2 Ratio x3.5`, `Feedback 6`. */
export function readout(param: Knobbed, value: number) {
  if (param in GLOBAL) {
    return `${GLOBAL[param as keyof typeof GLOBAL]} ${Math.round(value)}`;
  }
  const kind = param.slice(0, -1) as OperatorParam;
  const shown = kind === "ratio" ? ratioText(value) : Math.round(value);
  return `Op${param.at(-1)} ${OPERATOR[kind]} ${shown}`;
}
