import type { CompressorState } from "@/components/audio-ui/devices/compressor/device";

/** The panel's controls, as the panel speaks them: a knob on 0 to 10, a switch with its stops. */
export interface Panel {
  attack: number;
  auto: boolean;
  /** Whether the compressor is in the signal's path. */
  engaged: boolean;
  input: number;
  knee: "Hard" | "Soft";
  makeup: number;
  mix: number;
  output: number;
  ratio: number;
  release: number;
  threshold: number;
}

export type Knob =
  | "attack"
  | "input"
  | "makeup"
  | "mix"
  | "output"
  | "ratio"
  | "release"
  | "threshold";

export const DEFAULTS: Panel = {
  attack: 3,
  auto: true,
  engaged: true,
  input: 5,
  knee: "Soft",
  makeup: 3,
  mix: 10,
  output: 7,
  ratio: 4,
  release: 4,
  threshold: 4,
};

const unit = (value: number) => value / 10;

/** The units of each knob: what it means once it is turned. */
export const thresholdDb = (value: number) => -unit(value) * 50;
export const ratioOf = (value: number) => 20 ** unit(value);
export const attackMs = (value: number) => 0.3 * 300 ** unit(value);
export const releaseMs = (value: number) => 20 * 50 ** unit(value);
export const makeupDb = (value: number) => unit(value) * 18;
export const mixPercent = (value: number) => value * 10;
/** The input trim, plus or minus 12 dB around the knob's middle. */
export const inputDb = (value: number) => (value - 5) * 2.4;
/** The output level, in the shape the other devices give a volume: a squared curve, unity at the top. */
export const outputGain = (value: number) => unit(value) ** 2;

/** What the compressor engine is given for a panel. */
export function stateOf(panel: Panel): CompressorState {
  return {
    attackMs: attackMs(panel.attack),
    autoMakeup: panel.auto,
    enabled: panel.engaged,
    external: false,
    kneeDb: panel.knee === "Soft" ? 8 : 0,
    makeupDb: makeupDb(panel.makeup),
    mix: mixPercent(panel.mix),
    ratio: ratioOf(panel.ratio),
    releaseMs: releaseMs(panel.release),
    thresholdDb: thresholdDb(panel.threshold),
  };
}

/** What the screen reads for a knob: its value in its own unit. */
export function readout(knob: Knob, panel: Panel): string {
  switch (knob) {
    case "attack":
      return `Attack ${attackMs(panel.attack).toFixed(1)} ms`;
    case "input":
      return `Input ${inputDb(panel.input).toFixed(1)} dB`;
    case "makeup":
      return `Make-up ${makeupDb(panel.makeup).toFixed(1)} dB`;
    case "mix":
      return `Mix ${mixPercent(panel.mix)} %`;
    case "output":
      return `Output ${panel.output}`;
    case "ratio":
      return `Ratio ${ratioOf(panel.ratio).toFixed(1)}:1`;
    case "release":
      return `Release ${Math.round(releaseMs(panel.release))} ms`;
    case "threshold":
      return `Threshold ${thresholdDb(panel.threshold).toFixed(1)} dB`;
    default:
      return "";
  }
}
