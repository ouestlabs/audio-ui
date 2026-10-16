import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const TABLE_SAMPLES = 4096;
const CURVES = ["soft", "hard", "fold", "tube"] as const;
type SaturatorCurve = (typeof CURVES)[number];

/**
 * A saturator as a device: a drive pushed into one of four curves, mixed with
 * the clean sound at an output level, with no panel and no audio in it.
 */
export const saturatorDevice = defineDevice({
  description:
    "Adds warmth or dirt: the drive pushes the signal into a curve (soft clip, hard clip, wavefold or an asymmetric tube), mixed with the clean sound at an output level.",
  id: "audioui.saturator",
  name: "Saturator",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "soft",
      id: "curve",
      kind: "choice",
      label: "Curve",
      options: [
        { label: "Soft", value: "soft" },
        { label: "Hard", value: "hard" },
        { label: "Fold", value: "fold" },
        { label: "Tube", value: "tube" },
      ],
    },
    {
      default: 9,
      id: "driveDb",
      label: "Drive",
      max: 36,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 100,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      anchor: 0,
      default: -3,
      id: "outputDb",
      label: "Output",
      max: 12,
      min: -24,
      step: 0.5,
      unit: "dB",
    },
  ],
});

export type SaturatorState = DeviceState<typeof saturatorDevice.parameters>;

const gainOf = (db: number) => 10 ** (db / 20);

/** One curve at an input from -1 to 1, beyond which the node holds its end value. */
export function saturate(curve: SaturatorCurve, input: number) {
  const x = Math.max(-1, Math.min(1, input));
  switch (curve) {
    case "hard":
      return Math.max(-1, Math.min(1, 2 * x));
    case "fold":
      return Math.sin(1.5 * Math.PI * x);
    case "tube":
      return x >= 0
        ? Math.tanh(2.5 * x) / Math.tanh(2.5)
        : Math.tanh(1.2 * x) / Math.tanh(1.2);
    default:
      return Math.tanh(3 * x) / Math.tanh(3);
  }
}

/** The numbers that go on the nodes for a state. Off, the clean sound passes at unity. */
export function saturatorSettings(state: SaturatorState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    dry: 1 - mix,
    drive: gainOf(state.driveDb),
    output: state.enabled ? gainOf(state.outputDb) : 1,
    wet: mix,
  };
}

/** The curve as a table for a `WaveShaperNode`. The drive is applied before it, so the table depends on the curve alone. */
export function saturatorTable(
  curve: SaturatorCurve
): Float32Array<ArrayBuffer> {
  const table = new Float32Array(new ArrayBuffer(TABLE_SAMPLES * 4));
  for (let index = 0; index < TABLE_SAMPLES; index += 1) {
    table[index] = saturate(curve, (index * 2) / (TABLE_SAMPLES - 1) - 1);
  }
  return table;
}

/** The transfer curve a state plays: the output for an input from -1 to 1. */
export function saturatorCurve(state: SaturatorState) {
  const { dry, drive, output, wet } = saturatorSettings(state);
  return (input: number) =>
    output * (dry * input + wet * saturate(state.curve, drive * input));
}
