import { latency as lookaheadLatency } from "@audio/dynamics-limiter";
import { webAudioCompressorOutput } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { LIMITER_KERNELS } from "@/components/audio-ui/devices/limiter/kernels";
import { manifestWorklet } from "@/lib/manifest-worklet";
import { oversamplingSeconds } from "@/lib/oversampling";

const LIMITER_RATIO = 20;
/** How far ahead the browser's compressor node looks, in seconds. */
const NODE_LOOKAHEAD_SECONDS = 0.006;
/** A level well under any threshold, where the node only adds its make-up. */
const QUIET_DB = -120;

/**
 * A limiter as a device: an input gain pushed against a ceiling, with a
 * release, and no panel and no audio in it. Its clean model is the browser's
 * compressor node with a very high ratio and no knee and a final clip, the
 * way the master bus of the library ends; its look-ahead model the lookahead
 * brickwall limiter of `@audio/dynamics-limiter`.
 */
export const limiterDevice = defineDevice({
  description:
    "Keeps the sound under a ceiling: the input gain pushes the level against it, and what goes over is held down with a release for how fast it lets go. Its clean model is a compressor and a final clip that keeps every sample within 0.05 dB of the ceiling, measuring samples, not inter-sample (true) peaks. Its look-ahead model sees each peak coming by the look-ahead and ramps the gain down into it, with no clip, and with true peak on it keeps the waveform rebuilt between the samples under the ceiling too.",
  id: "audioui.limiter",
  // Clean, the node's look-ahead and the 4x oversampling of the clip; look-ahead, the model's own; off, the signal goes round both.
  latency: (state, sampleRate) => {
    if (!state.enabled) {
      return 0;
    }
    return state.model === "clean"
      ? NODE_LOOKAHEAD_SECONDS + oversamplingSeconds("4x", sampleRate)
      : lookaheadLatency({
          lookahead: state.lookaheadMs,
          sampleRate,
          truePeak: state.truePeak,
        }) / sampleRate;
  },
  name: "Limiter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "clean",
      id: "model",
      kind: "choice",
      label: "Model",
      options: [
        { label: "Clean", value: "clean" },
        { label: "Look-ahead", value: "lookahead" },
      ],
    },
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
    {
      default: 5,
      id: "lookaheadMs",
      label: "Look-ahead",
      max: 20,
      min: 0.1,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    { default: false, id: "truePeak", kind: "toggle", label: "True peak" },
  ],
});

export type LimiterState = DeviceState<typeof limiterDevice.parameters>;

const nodeOf = (ceilingDb: number) =>
  webAudioCompressorOutput({
    kneeDb: 0,
    ratio: LIMITER_RATIO,
    thresholdDb: ceilingDb,
  });

/** The controls a model does not use: the look-ahead model's own for the clean one. */
export function limiterUnused(model: LimiterState["model"]) {
  return model === "clean" ? (["lookaheadMs", "truePeak"] as const) : [];
}

/** The numbers that go on the nodes for a state. The node's own make-up is taken back out, so a signal under the ceiling is only as loud as the gain makes it. */
export function limiterSettings(state: LimiterState) {
  const node = nodeOf(state.ceilingDb);
  const makeupDb = node(QUIET_DB) - QUIET_DB;
  const clean = state.model === "clean";
  return {
    ceiling: 10 ** (state.ceilingDb / 20),
    gain: state.enabled ? 10 ** (state.gainDb / 20) : 1,
    model: state.model,
    /** What the look-ahead model is made with, in its manifest's units, a toggle as 0 or 1. */
    modelParams: {
      ceiling: state.ceilingDb,
      lookahead: state.lookaheadMs,
      release: state.releaseMs,
      truePeak: state.truePeak ? 1 : 0,
    },
    modelWet: state.enabled && !clean ? 1 : 0,
    release: state.releaseMs / 1000,
    threshold: state.ceilingDb,
    trim: 10 ** (-makeupDb / 20),
    wet: state.enabled && clean ? 1 : 0,
  };
}

/** The curve a state plays: the output level in dB for an input level in dB, gain and ceiling together. */
export function limiterCurve(state: LimiterState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  if (state.model === "lookahead") {
    // Every sample that would pass the ceiling is brought down to it.
    return (inputDb: number) =>
      Math.min(state.ceilingDb, inputDb + state.gainDb);
  }
  const node = nodeOf(state.ceilingDb);
  const makeupDb = node(QUIET_DB) - QUIET_DB;
  // The final clip: nothing is above the ceiling.
  return (inputDb: number) =>
    Math.min(state.ceilingDb, node(inputDb + state.gainDb) - makeupDb);
}

/**
 * The source of the look-ahead model's `AudioWorklet`, processor
 * `audioui-limiter`: the manifest of `@audio/dynamics-limiter`, played by
 * `manifestWorklet`. Every parameter makes it again.
 */
export const LIMITER_WORKLET = manifestWorklet({
  kernels: LIMITER_KERNELS,
  models: { lookahead: "limiter" },
  processor: "audioui-limiter",
});