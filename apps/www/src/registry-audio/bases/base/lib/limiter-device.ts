import { webAudioCompressorOutput } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const LIMITER_RATIO = 20;
/** A level well under any threshold, where the node only adds its make-up. */
const QUIET_DB = -120;

/**
 * A limiter as a device: an input gain pushed against a ceiling, with a
 * release, and no panel and no audio in it. It is the browser's compressor
 * node with a very high ratio and no knee, the way the master bus of the
 * library ends.
 */
export const limiterDevice = defineDevice({
  description:
    "Keeps the sound under a ceiling: the input gain pushes the level against it, a compressor holds down what goes over with a release for how fast it lets go, and a final clip keeps every sample within 0.05 dB of the ceiling. It measures samples, not inter-sample (true) peaks.",
  id: "audioui.limiter",
  name: "Limiter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 0,
      id: "gainDb",
      label: "Gain",
      max: 24,
      min: 0,
      step: 0.1,
      unit: "dB",
    },
    {
      default: -1,
      id: "ceilingDb",
      label: "Ceiling",
      max: 0,
      min: -24,
      step: 0.1,
      unit: "dB",
    },
    {
      default: 100,
      id: "releaseMs",
      label: "Release",
      max: 1000,
      min: 10,
      scale: "log",
      step: 1,
      unit: "ms",
    },
  ],
});

export type LimiterState = DeviceState<typeof limiterDevice.parameters>;

const nodeOf = (ceilingDb: number) =>
  webAudioCompressorOutput({
    kneeDb: 0,
    ratio: LIMITER_RATIO,
    thresholdDb: ceilingDb,
  });

/** The numbers that go on the nodes for a state. The node's own make-up is taken back out, so a signal under the ceiling is only as loud as the gain makes it. */
export function limiterSettings(state: LimiterState) {
  const node = nodeOf(state.ceilingDb);
  const makeupDb = node(QUIET_DB) - QUIET_DB;
  return {
    ceiling: 10 ** (state.ceilingDb / 20),
    gain: state.enabled ? 10 ** (state.gainDb / 20) : 1,
    release: state.releaseMs / 1000,
    threshold: state.ceilingDb,
    trim: 10 ** (-makeupDb / 20),
    wet: state.enabled ? 1 : 0,
  };
}

/** The curve a state plays: the output level in dB for an input level in dB, gain and ceiling together. */
export function limiterCurve(state: LimiterState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  const node = nodeOf(state.ceilingDb);
  const makeupDb = node(QUIET_DB) - QUIET_DB;
  // The final clip: nothing is above the ceiling.
  return (inputDb: number) =>
    Math.min(state.ceilingDb, node(inputDb + state.gainDb) - makeupDb);
}
