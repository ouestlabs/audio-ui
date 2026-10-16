import { webAudioCompressorOutput } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/**
 * A compressor as a device: its parameters and what they mean, with no panel
 * and no audio in it. A panel draws its state, an engine plays it, an agent
 * drives it through `deviceTools(compressorDevice)`.
 */
export const compressorDevice = defineDevice({
  description:
    "Brings loud parts down: above the threshold the level rises by one decibel for every ratio decibels in, with a soft knee, an attack and a release, make-up gain and a dry and compressed mix.",
  id: "audioui.compressor",
  name: "Compressor",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: -18,
      id: "thresholdDb",
      label: "Threshold",
      max: 0,
      min: -60,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 4,
      format: (ratio: number) => `${ratio.toFixed(1)}:1`,
      id: "ratio",
      label: "Ratio",
      max: 20,
      min: 1,
      scale: "log",
      step: 0.1,
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
      default: 80,
      id: "releaseMs",
      label: "Release",
      max: 1000,
      min: 10,
      scale: "log",
      step: 1,
      unit: "ms",
    },
    {
      default: 6,
      id: "kneeDb",
      label: "Knee",
      max: 40,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: true,
      id: "autoMakeup",
      kind: "toggle",
      label: "Auto make-up",
    },
    {
      default: 0,
      id: "makeupDb",
      label: "Make-up",
      max: 24,
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
  ],
});

export type CompressorState = DeviceState<typeof compressorDevice.parameters>;

/** How far ahead the node looks at the signal, in seconds: its latency, measured in Chrome at 44.1 and 48 kHz. The dry path is delayed by it so a parallel mix does not comb. */
export const COMPRESSOR_LOOKAHEAD_SECONDS = 0.006;

/** A level well under any threshold, where the node only adds its make-up. */
const QUIET_DB = -120;

/**
 * The make-up gain the browser's compressor node adds on its own, which it
 * cannot be told not to: it grows with the threshold and the ratio.
 */
export function nodeMakeupDb(
  state: Pick<CompressorState, "kneeDb" | "ratio" | "thresholdDb">
) {
  const curve = webAudioCompressorOutput({
    kneeDb: state.kneeDb,
    ratio: state.ratio,
    thresholdDb: state.thresholdDb,
  });
  return curve(QUIET_DB) - QUIET_DB;
}

/**
 * The numbers that go on the nodes for a state, as plain values. Pure, so
 * what an engine sets can be read and tested without an AudioContext.
 *
 * `trimDb` is what the engine adds after the node. The node's own make-up
 * cannot be turned off, so with `autoMakeup` off it is taken back out and
 * `makeupDb` put in its place, and with it on the node's is kept.
 */
export function compressorSettings(state: CompressorState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    attack: state.attackMs / 1000,
    dry: 1 - mix,
    knee: state.kneeDb,
    ratio: state.ratio,
    release: state.releaseMs / 1000,
    threshold: state.thresholdDb,
    trimDb: state.autoMakeup ? 0 : state.makeupDb - nodeMakeupDb(state),
    wet: mix,
  };
}

/**
 * The curve a state plays: the output level in dB for an input level in dB,
 * through the node, its trim and the dry and compressed mix.
 *
 * It is the static curve, the level once the gain has settled. A real
 * detector follows a signal with an attack and a release, so what you hear
 * sits above it by a little: measured in Chrome with a 440 Hz sine, about
 * 0.5 dB at the defaults and up to 1.3 dB with a slow attack and a short
 * release. Below the threshold it is exact.
 */
export function compressorCurve(state: CompressorState) {
  const { dry, trimDb, wet } = compressorSettings(state);
  const node = webAudioCompressorOutput({
    kneeDb: state.kneeDb,
    ratio: state.ratio,
    thresholdDb: state.thresholdDb,
  });
  return (inputDb: number) => {
    const wetDb = node(inputDb) + trimDb;
    const amplitude = dry * 10 ** (inputDb / 20) + wet * 10 ** (wetDb / 20);
    return amplitude > 0
      ? 20 * Math.log10(amplitude)
      : Number.NEGATIVE_INFINITY;
  };
}
