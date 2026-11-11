import { formatHz, SAMPLE_RATE } from "@audio-ui/engine/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { LOFI_KERNELS } from "@audio-ui/engine/kernels";

/**
 * A lo-fi as a device: how much the pitch drifts and wobbles, a hiss and the
 * crackle of dust, the band a high-pass and a low-pass leave, and a tape
 * drive, with no panel and no audio in it. A panel draws its state, an engine
 * plays it, an agent drives it through `deviceTools(lofiDevice)`.
 */
export const lofiDevice = defineDevice({
  description:
    "Ages the sound like a worn tape or a record: its pitch drifts slowly (wow) and wobbles fast (flutter), a hiss and the crackle of dust ride under it, its band narrows between a high-pass and a low-pass, and a tape drive saturates it.",
  id: "audioui.lofi",
  name: "Lo-fi",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 30,
      id: "wow",
      label: "Wow",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 20,
      id: "flutter",
      label: "Flutter",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 10,
      id: "noise",
      label: "Hiss",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 10,
      id: "crackle",
      label: "Crackle",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 6000,
      format: formatHz,
      id: "lowpassHz",
      label: "Low-pass",
      max: 18_000,
      min: 500,
      scale: "log",
      step: 10,
    },
    {
      default: 60,
      format: formatHz,
      id: "highpassHz",
      label: "High-pass",
      max: 500,
      min: 20,
      scale: "log",
      step: 1,
    },
    {
      default: 30,
      id: "drive",
      label: "Drive",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type LofiState = DeviceState<typeof lofiDevice.parameters>;

/** The numbers that go on the worklet for a state, its shares from 0 to 1, and the path the sound takes: off, it passes clean. */
export function lofiSettings(state: LofiState) {
  return {
    crackle: state.crackle / 100,
    drive: state.drive / 100,
    dry: state.enabled ? 0 : 1,
    flutter: state.flutter / 100,
    highpass: state.highpassHz,
    lowpass: state.lowpassHz,
    noise: state.noise / 100,
    wet: state.enabled ? 1 : 0,
    wow: state.wow / 100,
  };
}

/** A one-pole low-pass's coefficient at a frequency, as the kernel sets it. */
const onePole = (hz: number, sampleRate: number) =>
  1 - Math.exp((-2 * Math.PI * hz) / sampleRate);

/**
 * The band a state leaves, in dB at each frequency: the kernel's three
 * one-pole low-passes in a row, 18 dB an octave above the low-pass, and its
 * one-pole high-pass under the high-pass. Flat when it is off.
 */
export function lofiCurve(state: LofiState) {
  if (!state.enabled) {
    return () => 0;
  }
  const low = onePole(state.lowpassHz, SAMPLE_RATE);
  const high = onePole(state.highpassHz, SAMPLE_RATE);
  return (hz: number) => {
    const turn = (2 * Math.PI * hz) / SAMPLE_RATE;
    // 1 - (1 - a) e^(-jw), a one-pole's denominator.
    const below = (a: number) => {
      const re = 1 - (1 - a) * Math.cos(turn);
      const im = (1 - a) * Math.sin(turn);
      return { im, re };
    };
    const lp = below(low);
    const lpGain = low / Math.hypot(lp.re, lp.im);
    // The high-pass is 1 - a / (1 - (1 - a) e^(-jw)).
    const hp = below(high);
    const scale = high / (hp.re * hp.re + hp.im * hp.im);
    const hpGain = Math.hypot(1 - scale * hp.re, scale * hp.im);
    return 20 * Math.log10(Math.max(lpGain ** 3 * hpGain, 1e-6));
  };
}

/**
 * The lo-fi's processor for an `AudioWorklet`: the kernel of
 * `@audio/effect-lofi`, 128 frames at a time, its state kept per channel,
 * each channel with a noise of its own, at the shares and frequencies of its
 * `AudioParam`s. With nothing coming in it runs on silence until it is quiet,
 * which a hiss or a crackle never is: they play on, as a record's do.
 */
export const LOFI_WORKLET = `${LOFI_KERNELS}
const QUIET_SECONDS = 0.5;
const SILENT = 1e-6;
class AudioUiLofi extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "wow", defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "flutter", defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "noise", defaultValue: 0.1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "crackle", defaultValue: 0.1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "lowpass", defaultValue: 6000, minValue: 500, maxValue: 18000, automationRate: "k-rate" },
      { name: "highpass", defaultValue: 60, minValue: 20, maxValue: 500, automationRate: "k-rate" },
      { name: "drive", defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.channels = [];
    this.quiet = 0;
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(output && output.length > 0)) {
      return true;
    }
    const coming = input && input.length > 0;
    if (!coming && this.quiet >= QUIET_SECONDS * sampleRate) {
      return true;
    }
    let loudest = 0;
    for (let channel = 0; channel < output.length; channel += 1) {
      const data = output[channel];
      if (coming) {
        data.set(input[channel % input.length]);
      } else {
        data.fill(0);
      }
      this.channels[channel] ??= { fs: sampleRate, seed: (0x2545f491 ^ (channel * 0x9e3779b9)) >>> 0 };
      const state = this.channels[channel];
      state.wow = parameters.wow[0];
      state.flutter = parameters.flutter[0];
      state.noise = parameters.noise[0];
      state.crackle = parameters.crackle[0];
      state.lowpass = parameters.lowpass[0];
      state.highpass = parameters.highpass[0];
      state.drive = parameters.drive[0];
      lofi(data, state);
      for (let frame = 0; frame < data.length; frame += 1) {
        loudest = Math.max(loudest, Math.abs(data[frame]));
      }
    }
    this.quiet = coming || loudest > SILENT ? 0 : this.quiet + output[0].length;
    return true;
  }
}
registerProcessor("audioui-lofi", AudioUiLofi);
`;
