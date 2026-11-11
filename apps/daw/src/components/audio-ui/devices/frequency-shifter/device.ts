import { formatHz } from "@audio-ui/engine/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { FREQUENCY_SHIFTER_KERNELS } from "@/components/audio-ui/devices/frequency-shifter/kernels";

/**
 * How long the shifter's Hilbert filter is for each precision, in taps: a
 * longer one keeps low notes clean, and delays the sound by half its length.
 */
export const PRECISION_TAPS = { high: 255, low: 17, medium: 65 } as const;

/**
 * A frequency shifter as a device: every frequency of the sound moved by the
 * same number of hertz, or ring-modulated by a sine, mixed with the clean
 * sound, with no panel and no audio in it.
 */
export const frequencyShifterDevice = defineDevice({
  description:
    "Moves every frequency of the sound by the same number of hertz, up or down, so its harmonics no longer line up, or in ring mode multiplies it by a sine, leaving the sum and the difference of each frequency and the sine's, mixed with the clean sound.",
  id: "audioui.frequency-shifter",
  // The shifter's Hilbert filter delays the sound, the clean part with it, by half its length.
  latency: (state, sampleRate) =>
    state.mode === "shift"
      ? (PRECISION_TAPS[state.precision] - 1) / 2 / sampleRate
      : 0,
  name: "Frequency Shifter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "shift",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Shift", value: "shift" },
        { label: "Ring", value: "ring" },
      ],
    },
    {
      anchor: 0,
      default: 100,
      id: "shiftHz",
      label: "Shift",
      max: 2000,
      min: -2000,
      step: 1,
      unit: "Hz",
    },
    {
      default: 440,
      format: formatHz,
      id: "frequencyHz",
      label: "Frequency",
      max: 5000,
      min: 1,
      scale: "log",
      step: 0.1,
    },
    {
      default: "medium",
      id: "precision",
      kind: "choice",
      label: "Precision",
      options: [
        { label: "Low", value: "low" },
        { label: "Mid", value: "medium" },
        { label: "High", value: "high" },
      ],
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

export type FrequencyShifterState = DeviceState<
  typeof frequencyShifterDevice.parameters
>;

/** The order the worklet plays the modes in, one output each. */
export const FREQUENCY_SHIFTER_MODES = ["shift", "ring"] as const;

/** The numbers that go on the worklet and the nodes for a state. Off, the clean sound passes. */
export function frequencyShifterSettings(state: FrequencyShifterState) {
  return {
    frequency: state.frequencyHz,
    mix: state.enabled ? state.mix / 100 : 0,
    modes: FREQUENCY_SHIFTER_MODES.map((mode) => (mode === state.mode ? 1 : 0)),
    shift: state.shiftHz,
    taps: PRECISION_TAPS[state.precision],
  };
}

/**
 * What a state does to a note and its harmonics: the frequencies that go in,
 * from `toneHz` up, and the ones that come out. A shift moves each by the
 * same hertz, one below 0 coming back up as its mirror; a ring leaves the sum
 * and the difference of each and the sine's, each frequency once. The clean
 * ones stay as they are while the mix lets them through.
 */
export function frequencyShifterPartials(
  state: FrequencyShifterState,
  toneHz = 220,
  count = 6
) {
  const input = Array.from(
    { length: count },
    (_, index) => toneHz * (index + 1)
  );
  const output =
    state.mode === "shift"
      ? input.map((hz) => Math.abs(hz + state.shiftHz))
      : input.flatMap((hz) => [
          Math.abs(hz - state.frequencyHz),
          hz + state.frequencyHz,
        ]);
  // Each once, though a ring can leave the same one twice.
  return { input, output: [...new Set(output.filter((hz) => hz > 0))] };
}

/**
 * The source of the frequency shifter's `AudioWorklet`, processor
 * `audioui-frequency-shifter`: the frequency shifter of
 * `@audio/effect-freqshift` and the ring modulator of `@audio/effect-ringmod`,
 * per channel, each with its own mix. It plays both, one output each in the
 * order of `FREQUENCY_SHIFTER_MODES`, so the engine fades between them without
 * a click. Its parameters are the shift, the ring's frequency, the mix and the
 * shifter's taps; new taps wait for the choice to rest, then fade in on a
 * fresh shifter.
 */
export const FREQUENCY_SHIFTER_WORKLET = `${FREQUENCY_SHIFTER_KERNELS}
const REST_SECONDS = 0.12;
const FADE_SECONDS = 0.08;

class AudioUiFrequencyShifter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "shift", defaultValue: 100, minValue: -20000, maxValue: 20000, automationRate: "k-rate" },
      { name: "frequency", defaultValue: 440, minValue: 0, maxValue: 20000, automationRate: "k-rate" },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "taps", defaultValue: 65, minValue: 3, maxValue: 1023, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.shifters = null;
    this.leaving = null;
    this.rings = [];
    this.target = 0;
    this.resting = 0;
    this.scratch = new Float32Array(0);
  }
  /** One shifter per channel, at a number of taps. */
  shiftersOf(taps) {
    return { states: [], taps };
  }
  shiftInto(shifters, channel, sound, data, parameters) {
    shifters.states[channel] ??= { fs: sampleRate, taps: shifters.taps };
    const state = shifters.states[channel];
    state.shift = parameters.shift[0];
    state.mix = parameters.mix[0];
    data.set(sound);
    frequencyShifter(data, state);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!(input && input.length > 0)) {
      return true;
    }
    const taps = Math.round((parameters.taps[0] - 1) / 2) * 2 + 1;
    if (!this.shifters) {
      this.shifters = this.shiftersOf(taps);
    }
    // New taps, once the choice has stood still long enough.
    const frames = input[0].length;
    this.resting = taps === this.target ? this.resting + frames : 0;
    this.target = taps;
    if (!this.leaving && taps !== this.shifters.taps && this.resting >= REST_SECONDS * sampleRate) {
      const fade = Math.round(FADE_SECONDS * sampleRate);
      this.leaving = { left: fade, shifters: this.shifters, total: fade };
      this.shifters = this.shiftersOf(taps);
    }
    if (this.scratch.length < frames) {
      this.scratch = new Float32Array(frames);
    }
    const [shifted, ringed] = outputs;
    for (let channel = 0; channel < shifted.length; channel += 1) {
      const sound = input[channel] ?? input[0];
      const data = shifted[channel];
      this.shiftInto(this.shifters, channel, sound, data, parameters);
      if (this.leaving) {
        const old = this.scratch.subarray(0, frames);
        this.shiftInto(this.leaving.shifters, channel, sound, old, parameters);
        for (let frame = 0; frame < frames; frame += 1) {
          // An equal-power fade: the two are delayed apart, so they hardly correlate.
          const share = (Math.max(0, this.leaving.left - frame) / this.leaving.total) * Math.PI / 2;
          data[frame] = data[frame] * Math.cos(share) + old[frame] * Math.sin(share);
        }
      }
      const ring = ringed[channel];
      ring.set(sound);
      this.rings[channel] ??= { fs: sampleRate };
      const state = this.rings[channel];
      state.fc = parameters.frequency[0];
      state.mix = parameters.mix[0];
      ringMod(ring, state);
    }
    if (this.leaving) {
      this.leaving.left -= frames;
      if (this.leaving.left <= 0) {
        this.leaving = null;
      }
    }
    return true;
  }
}
registerProcessor("audioui-frequency-shifter", AudioUiFrequencyShifter);
`;