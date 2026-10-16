import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** How far ahead of the signal the detector reads, in seconds: the audio waits this long so the gain is already up when a hit arrives. It is the latency of the device. */
export const LOOKAHEAD_SECONDS = 0.001;

/**
 * A transient shaper as a device: it turns the attack of a sound up or down
 * and the sustain after it up or down, whatever the level of the sound, with
 * no panel and no audio in it. A drum loses its click or gains it, a pluck
 * rings longer or shorter, and none of it needs a threshold.
 */
export const transientDevice = defineDevice({
  description:
    "Shapes the attack and the sustain of a sound: the attack is the moment a hit starts, the sustain is what rings after it, and each is turned up or down by up to 12 dB, at any level of the signal, with an output gain.",
  id: "audioui.transient",
  // The audio waits for the detector, on or off, so the delay is the same either way.
  latency: () => LOOKAHEAD_SECONDS,
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
    attack: on ? state.attackDb : 0,
    output: on ? 10 ** (state.outputDb / 20) : 1,
    sustain: on ? state.sustainDb : 0,
  };
}

/**
 * The processor of the shaper, as the source of an `AudioWorklet`. It reads
 * the signal and writes the gain to apply, one value per sample. Two views
 * of the signal's peak, which jumps up and falls over 15 ms so a low note does
 * not ripple it, the peak itself and the same peak smoothed over 25 ms, meet
 * when a sound holds and part when a hit starts: how far the peak is over the
 * smoothed one, in dB, says how much of the moment is attack (6 dB or more is
 * all of it), and the rest is sustain. The gain in dB is the attack
 * amount times the attack share plus the sustain amount times the sustain
 * share, smoothed over a millisecond. It does not depend on the level of the
 * signal, only on the shape of its envelope. The engine loads it from a blob,
 * so there is no file to serve.
 */
export const TRANSIENT_WORKLET = `
class AudioUiTransient extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "attack", defaultValue: 0, minValue: -24, maxValue: 24, automationRate: "k-rate" },
      { name: "sustain", defaultValue: 0, minValue: -24, maxValue: 24, automationRate: "k-rate" }
    ];
  }
  constructor() {
    super();
    this.peak = 0;
    this.slow = 0;
    this.gainDb = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const out = outputs[0][0];
    if (!out) return true;
    const attackDb = parameters.attack[0];
    const sustainDb = parameters.sustain[0];
    const fall = Math.exp(-1 / (0.015 * sampleRate));
    const slowStep = 1 - Math.exp(-1 / (0.025 * sampleRate));
    const smooth = 1 - Math.exp(-1 / (0.001 * sampleRate));
    for (let n = 0; n < out.length; n += 1) {
      let peak = 0;
      for (let c = 0; c < input.length; c += 1) {
        const v = Math.abs(input[c][n]);
        if (v > peak) peak = v;
      }
      this.peak = peak > this.peak ? peak : this.peak * fall;
      this.slow += (this.peak - this.slow) * slowStep;
      let target = 0;
      if (this.slow > 0.0001) {
        const difference = 20 * Math.log10((this.peak + 1e-6) / (this.slow + 1e-6));
        const share = Math.min(1, Math.max(0, difference / 6));
        target = attackDb * share + sustainDb * (1 - share);
      }
      this.gainDb += (target - this.gainDb) * smooth;
      out[n] = Math.pow(10, this.gainDb / 20);
    }
    return true;
  }
}
registerProcessor("audioui-transient", AudioUiTransient);
`;
