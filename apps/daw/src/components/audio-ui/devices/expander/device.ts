import { expanderGain, upwardExpanderGain } from "@audio/dynamics-expander";
import { expander } from "@audio/dynamics-expander/audio";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { EXPANDER_KERNELS } from "@/components/audio-ui/devices/expander/kernels";
import { manifestWorklet } from "@/lib/manifest-worklet";

/**
 * An expander as a device: the expander of `@audio/dynamics-expander`, its
 * parameters and the curve it plays, with no panel and no audio in it.
 * Downward, it turns down what falls under the threshold, softer than a gate;
 * upward, it lifts what rises over it, giving back the peaks a limiter
 * flattened.
 */
export const expanderDevice = defineDevice({
  description:
    "Widens the dynamics. Downward, it turns down what falls under the threshold, by the ratio for every decibel under it, never by more than the range: softer than a gate. Upward, it lifts what rises over the threshold the same way, never by more than the range, giving back the peaks a limiter flattened. The knee softens the turn at the threshold, and the attack and the release say how fast it follows the level.",
  id: "audioui.expander",
  name: "Expander",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "downward",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Downward", value: "downward" },
        { label: "Upward", value: "upward" },
      ],
    },
    {
      default: -30,
      id: "thresholdDb",
      label: "Threshold",
      max: 0,
      min: -80,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 2,
      format: (ratio: number) => `1:${ratio.toFixed(1)}`,
      id: "ratio",
      label: "Ratio",
      max: 20,
      min: 1,
      scale: "log",
      step: 0.1,
    },
    {
      default: 6,
      id: "kneeDb",
      label: "Knee",
      max: 24,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 40,
      id: "rangeDb",
      label: "Range",
      max: 90,
      min: 0,
      step: 1,
      unit: "dB",
    },
    {
      default: 5,
      id: "attackMs",
      label: "Attack",
      max: 100,
      min: 0.1,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    {
      default: 50,
      id: "releaseMs",
      label: "Release",
      max: 1000,
      min: 1,
      scale: "log",
      step: 1,
      unit: "ms",
    },
  ],
});

export type ExpanderState = DeviceState<typeof expanderDevice.parameters>;

/** The numbers that go on the worklet for a state, in the manifest's units: the mode by its index, the range as a magnitude. Off, the sound goes round it. */
export function expanderSettings(state: ExpanderState) {
  return {
    modelParams: {
      attack: state.attackMs,
      knee: state.kneeDb,
      mode: expander.params.mode.values.indexOf(state.mode),
      range: state.rangeDb,
      ratio: state.ratio,
      release: state.releaseMs,
      threshold: state.thresholdDb,
    },
    wet: state.enabled ? 1 : 0,
  };
}

/** The curve a state plays: the output level in dB for an input level in dB, once the level has settled, through the package's own gain curves. */
export function expanderCurve(state: ExpanderState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  const { kneeDb, rangeDb, ratio, thresholdDb } = state;
  if (state.mode === "upward") {
    return (inputDb: number) =>
      inputDb +
      upwardExpanderGain(inputDb, thresholdDb, ratio, kneeDb, rangeDb);
  }
  return (inputDb: number) =>
    inputDb + expanderGain(inputDb, thresholdDb, ratio, kneeDb, -rangeDb);
}

/**
 * The source of the expander's `AudioWorklet`, processor `audioui-expander`:
 * the manifest of `@audio/dynamics-expander`, played by `manifestWorklet`.
 * The mode, the threshold, the ratio, the knee and the range change as it
 * plays; the attack and the release make it again.
 */
export const EXPANDER_WORKLET = manifestWorklet({
  kernels: EXPANDER_KERNELS,
  models: { expander: "expander" },
  processor: "audioui-expander",
});