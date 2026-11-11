import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { TRANSIENT_KERNELS } from "@audio-ui/engine/kernels";
import { manifestWorklet } from "@/registry-audio/bases/base/lib/manifest-worklet";

/**
 * A transient shaper as a device: it turns the attack of a sound up or down
 * and the sustain after it up or down, whatever the level of the sound, with
 * no panel and no audio in it. A drum loses its click or gains it, a pluck
 * rings longer or shorter, and none of it needs a threshold. It is the
 * transient shaper of `@audio/dynamics-transient-shaper`.
 */
export const transientDevice = defineDevice({
  description:
    "Shapes the attack and the sustain of a sound: the attack is the moment a hit starts, the sustain is what rings after it, and each is turned up or down by up to 12 dB, at any level of the signal, with an output gain. It tells the attack by how far the level rises over a copy of it 50 times slower and moves the gain in a line between the attack's and the sustain's.",
  id: "audioui.transient",
  name: "Transient shaper",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 6,
      id: "attackDb",
      label: "Attack",
      max: 12,
      min: -12,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 0,
      id: "sustainDb",
      label: "Sustain",
      max: 12,
      min: -12,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 0,
      id: "outputDb",
      label: "Output",
      max: 12,
      min: -12,
      step: 0.5,
      unit: "dB",
    },
  ],
});

export type TransientState = DeviceState<typeof transientDevice.parameters>;

/** The numbers that go on the nodes for a state. Off, the shaping is nothing and the output is unity. */
export function transientSettings(state: TransientState) {
  const on = state.enabled;
  return {
    /** What the model plays, in its manifest's units: the gain added on an attack and on the sustain, as a share, so an attack all attack gets the decibels asked. */
    modelParams: {
      attackGain: on ? 10 ** (state.attackDb / 20) - 1 : 0,
      sustainGain: on ? 10 ** (state.sustainDb / 20) - 1 : 0,
    },
    output: on ? 10 ** (state.outputDb / 20) : 1,
  };
}

/**
 * The source of the shaper's `AudioWorklet`, processor `audioui-transient`:
 * the manifest of `@audio/dynamics-transient-shaper`, played by
 * `manifestWorklet`. Its attack and sustain change as it plays.
 */
export const TRANSIENT_WORKLET = manifestWorklet({
  kernels: TRANSIENT_KERNELS,
  models: { shaper: "transientShaper" },
  processor: "audioui-transient",
});
