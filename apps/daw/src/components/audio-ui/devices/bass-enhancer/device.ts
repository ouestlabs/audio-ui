import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { BASS_ENHANCER_KERNELS } from "@/components/audio-ui/devices/bass-enhancer/kernels";

/** The kernel's two filters: the sub it takes, under the frequency, and the band its harmonics go to, 2.5 times above. */
const SUB_DAMPING = 1.2;
const HARMONICS_DAMPING = 0.8;
const HARMONICS_ABOVE = 2.5;

/**
 * A bass enhancer as a device: the lows under a frequency, shaped into their
 * harmonics, so a small speaker that cannot play a bass still lets it be
 * heard, with no panel and no audio in it.
 */
export const bassEnhancerDevice = defineDevice({
  description:
    "Makes a bass heard on small speakers: the lows under a frequency are shaped into their harmonics, which a small speaker can play and from which the ear hears the bass, added as an amount; the sub itself kept whole, or thinned.",
  id: "audioui.bass-enhancer",
  name: "Bass Enhancer",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 80,
      format: formatHz,
      id: "frequencyHz",
      label: "Frequency",
      max: 200,
      min: 30,
      scale: "log",
      step: 1,
    },
    {
      default: 50,
      id: "drive",
      label: "Drive",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 50,
      id: "amount",
      label: "Amount",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 100,
      id: "keep",
      label: "Sub",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type BassEnhancerState = DeviceState<
  typeof bassEnhancerDevice.parameters
>;

/** The numbers that go on the worklet for a state, the kernel's own. Off, nothing is added and the sub is all kept. */
export function bassEnhancerSettings(state: BassEnhancerState) {
  return {
    amount: state.enabled ? state.amount / 100 : 0,
    drive: state.drive / 100,
    fc: state.frequencyHz,
    keep: state.enabled ? state.keep / 100 : 1,
  };
}

/** The gain in dB of an analog second-order section at `ratio` of its frequency: its low-pass, or its band-pass. */
function section(ratio: number, damping: number, band: boolean) {
  const magnitude =
    (band ? damping * ratio : 1) /
    Math.hypot(1 - ratio * ratio, damping * ratio);
  return 20 * Math.log10(Math.max(1e-9, magnitude));
}

/**
 * The two bands of a state, in dB at each frequency, as the kernel's
 * state-variable filters make them: `sub`, the low-pass under the frequency
 * it takes its harmonics from, and `harmonics`, the band-pass 2.5 times above
 * that it keeps them in, its peak at 0 dB.
 */
export function bassEnhancerBands(state: BassEnhancerState) {
  const at = state.frequencyHz;
  return {
    harmonics: (hz: number) =>
      section(hz / (at * HARMONICS_ABOVE), HARMONICS_DAMPING, true),
    sub: (hz: number) => section(hz / at, SUB_DAMPING, false),
  };
}

/**
 * The source of the bass enhancer's `AudioWorklet`, processor
 * `audioui-bass-enhancer`: the bass enhancer of `@audio/effect-subbass`, per
 * channel, the sound with the harmonics of its lows. Its parameters are the
 * frequency, the drive, the amount and the share of the sub kept.
 */
export const BASS_ENHANCER_WORKLET = `${BASS_ENHANCER_KERNELS}
class AudioUiBassEnhancer extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "fc", defaultValue: 80, minValue: 10, maxValue: 1000, automationRate: "k-rate" },
      { name: "drive", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "amount", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "keep", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.states = [];
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(input && input.length > 0 && output)) {
      return true;
    }
    for (let channel = 0; channel < output.length; channel += 1) {
      const data = output[channel];
      data.set(input[channel] ?? input[0]);
      this.states[channel] ??= { fs: sampleRate };
      const state = this.states[channel];
      state.fc = parameters.fc[0];
      state.drive = parameters.drive[0];
      state.amount = parameters.amount[0];
      state.keep = parameters.keep[0];
      subbass(data, state);
    }
    return true;
  }
}
registerProcessor("audioui-bass-enhancer", AudioUiBassEnhancer);
`;