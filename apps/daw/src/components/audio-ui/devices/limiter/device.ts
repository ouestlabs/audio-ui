import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { limiterLatency as lookaheadLatency } from "@audio-ui/engine/dsp";
import { LIMITER_KERNELS } from "@audio-ui/engine/kernels";
import { manifestWorklet } from "@/lib/manifest-worklet";

/**
 * A limiter as a device: an input gain pushed against a ceiling, with a
 * release, and no panel and no audio in it. It is the look-ahead brickwall
 * limiter of `@audio/dynamics-limiter`.
 */
export const limiterDevice = defineDevice({
  description:
    "Keeps the sound under a ceiling: the input gain pushes the level against it, and what goes over is held down with a release for how fast it lets go. It sees each peak coming by the look-ahead and ramps the gain down into it, and with true peak on it keeps the waveform rebuilt between the samples under the ceiling too.",
  id: "audioui.limiter",
  // The model's own look-ahead; off, the signal goes round it.
  latency: (state, sampleRate) =>
    state.enabled
      ? lookaheadLatency({
          lookahead: state.lookaheadMs,
          sampleRate,
          truePeak: state.truePeak,
        }) / sampleRate
      : 0,
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

/** The numbers that go on the nodes for a state: the input gain, and what the worklet is made with, in its manifest's units, a toggle as 0 or 1. */
export function limiterSettings(state: LimiterState) {
  return {
    gain: state.enabled ? 10 ** (state.gainDb / 20) : 1,
    modelParams: {
      ceiling: state.ceilingDb,
      lookahead: state.lookaheadMs,
      release: state.releaseMs,
      truePeak: state.truePeak ? 1 : 0,
    },
    wet: state.enabled ? 1 : 0,
  };
}

/** The curve a state plays: the output level in dB for an input level in dB, gain and ceiling together. */
export function limiterCurve(state: LimiterState) {
  if (!state.enabled) {
    return (inputDb: number) => inputDb;
  }
  // Every sample that would pass the ceiling is brought down to it.
  return (inputDb: number) => Math.min(state.ceilingDb, inputDb + state.gainDb);
}

/**
 * The source of the limiter's `AudioWorklet`, processor
 * `audioui-limiter`: the manifest of `@audio/dynamics-limiter`, played by
 * `manifestWorklet`. Every parameter makes it again.
 */
export const LIMITER_WORKLET = manifestWorklet({
  kernels: LIMITER_KERNELS,
  models: { brickwall: "limiter" },
  processor: "audioui-limiter",
});
