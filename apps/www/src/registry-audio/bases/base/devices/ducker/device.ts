import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { compressorGain } from "@audio-ui/engine/dsp";
import { DUCKER_KERNELS } from "@audio-ui/engine/kernels";
import { manifestWorklet } from "@/registry-audio/bases/base/lib/manifest-worklet";

/**
 * A ducker as a device: the ducker of `@audio/dynamics-ducker`, its
 * parameters and the gain it takes off for a level of the key, with no panel
 * and no audio in it. The key is another signal, connected to the engine's
 * `sidechain`: a voice ducks the music, a kick ducks a pad.
 */
export const duckerDevice = defineDevice({
  description:
    "Turns a sound down while another one plays: the key, connected to the sidechain, a voice over music or a kick under a pad. Above the threshold, each decibel of the key takes the ratio's share of a decibel off the sound, through a soft knee, never more than the range. The attack and the release say how fast it ducks and comes back. With no key, it follows the sound itself.",
  id: "audioui.ducker",
  name: "Ducker",
  sidechain: true,
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: -30,
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
      default: 6,
      id: "kneeDb",
      label: "Knee",
      max: 24,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 24,
      id: "rangeDb",
      label: "Range",
      max: 90,
      min: 0,
      step: 1,
      unit: "dB",
    },
    {
      default: 20,
      id: "attackMs",
      label: "Attack",
      max: 200,
      min: 0.1,
      scale: "log",
      step: 0.1,
      unit: "ms",
    },
    {
      default: 300,
      id: "releaseMs",
      label: "Release",
      max: 2000,
      min: 1,
      scale: "log",
      step: 1,
      unit: "ms",
    },
  ],
});

export type DuckerState = DeviceState<typeof duckerDevice.parameters>;

/** The numbers that go on the worklet for a state, in the manifest's units: the range as a cut. Off, the sound goes round it. */
export function duckerSettings(state: DuckerState) {
  return {
    modelParams: {
      attack: state.attackMs,
      knee: state.kneeDb,
      range: -state.rangeDb,
      ratio: state.ratio,
      release: state.releaseMs,
      threshold: state.thresholdDb,
    },
    wet: state.enabled ? 1 : 0,
  };
}

/** The gain a state puts on the sound, in dB, for a level of the key in dB, once it has settled: the package's own compression curve, held within the range. */
export function duckerCurve(state: DuckerState) {
  if (!state.enabled) {
    return () => 0;
  }
  const { kneeDb, rangeDb, ratio, thresholdDb } = state;
  return (keyDb: number) =>
    Math.max(-rangeDb, compressorGain(keyDb, thresholdDb, ratio, kneeDb));
}

/**
 * The source of the ducker's `AudioWorklet`, processor `audioui-ducker`: the
 * manifest of `@audio/dynamics-ducker`, played by `manifestWorklet`, the
 * sound on its first input and the key on its second. The threshold, the
 * ratio, the knee and the range change as it plays; the attack and the
 * release make it again.
 */
export const DUCKER_WORKLET = manifestWorklet({
  kernels: DUCKER_KERNELS,
  models: { ducker: "ducker" },
  processor: "audioui-ducker",
});
