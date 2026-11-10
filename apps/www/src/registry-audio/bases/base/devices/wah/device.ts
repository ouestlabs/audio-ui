import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/core/time";
import { WAH_KERNELS } from "@/registry-audio/bases/base/devices/wah/kernels";
import {
  lfoRate,
  SYNCED_RATE_PARAMETERS,
} from "@/registry-audio/bases/base/lib/synced-rate";

/**
 * A wah as a device: a resonant band-pass whose frequency an envelope of the
 * sound moves, or a slow oscillator, or a pedal held at one place, mixed with
 * the clean sound at an output level, with no panel and no audio in it.
 */
export const wahDevice = defineDevice({
  description:
    "Sweeps a resonant band-pass through the sound: in envelope mode the louder the sound the higher it goes, in sweep mode a slow oscillator moves it, in pedal mode it stays where it is set, mixed with the clean sound at an output level.",
  id: "audioui.wah",
  name: "Wah",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "envelope",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Envelope", value: "envelope" },
        { label: "Sweep", value: "sweep" },
        { label: "Pedal", value: "pedal" },
      ],
    },
    {
      default: 400,
      format: formatHz,
      id: "frequencyHz",
      label: "Frequency",
      max: 5000,
      min: 50,
      scale: "log",
      step: 1,
    },
    {
      default: 3000,
      format: formatHz,
      id: "rangeHz",
      label: "Range",
      max: 6000,
      min: 100,
      scale: "log",
      step: 1,
    },
    {
      default: 2,
      format: (times: number) => `${times.toFixed(1)}×`,
      id: "sensitivity",
      label: "Sensitivity",
      max: 10,
      min: 0.5,
      scale: "log",
      step: 0.1,
    },
    {
      default: 2,
      id: "attackMs",
      label: "Attack",
      max: 50,
      min: 0.5,
      scale: "log",
      step: 0.1,
      unit: "ms",
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
      default: 1.5,
      id: "rateHz",
      label: "Rate",
      max: 10,
      min: 0.05,
      scale: "log",
      step: 0.05,
      unit: "Hz",
    },
    ...SYNCED_RATE_PARAMETERS,
    {
      default: 0.8,
      id: "depth",
      label: "Depth",
      max: 3,
      min: 0,
      step: 0.05,
      unit: "oct",
    },
    {
      default: 5,
      id: "resonance",
      label: "Resonance",
      max: 20,
      min: 0.5,
      scale: "log",
      step: 0.1,
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
    {
      anchor: 0,
      default: 0,
      id: "outputDb",
      label: "Output",
      max: 12,
      min: -24,
      step: 0.5,
      unit: "dB",
    },
  ],
});

export type WahState = DeviceState<typeof wahDevice.parameters>;

/** The order the worklet plays the modes in, one output each. */
export const WAH_MODES = ["envelope", "sweep", "pedal"] as const;

/** The numbers that go on the worklet and the nodes for a state. Off, the clean sound passes at unity. */
export function wahSettings(state: WahState, tempo: Tempo = DEFAULT_TEMPO) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    attack: state.attackMs / 1000,
    depth: state.depth,
    dry: 1 - mix,
    frequency: state.frequencyHz,
    modes: WAH_MODES.map((mode) => (mode === state.mode ? 1 : 0)),
    output: state.enabled ? 10 ** (state.outputDb / 20) : 1,
    q: state.resonance,
    range: state.rangeHz,
    rate: lfoRate(state, tempo),
    release: state.releaseMs / 1000,
    sensitivity: state.sensitivity,
    wet: mix,
  };
}

/**
 * How far the band travels in a state's mode, from its lowest to its highest
 * frequency, and where it rests: an envelope lifts it from the frequency by up
 * to the range, an oscillator sweeps it the depth either side in octaves, a
 * pedal holds it.
 */
export function wahReach(state: WahState) {
  const at = state.frequencyHz;
  if (state.mode === "envelope") {
    return { high: at + state.rangeHz, low: at, rest: at };
  }
  if (state.mode === "sweep") {
    return {
      high: at * 2 ** state.depth,
      low: at * 2 ** -state.depth,
      rest: at,
    };
  }
  return { high: at, low: at, rest: at };
}

/**
 * The curve a state plays with the band at `bandHz`: the gain in dB at each
 * frequency of the band-pass mixed with the clean sound, at the output level.
 * The kernels' filter is the trapezoidal state-variable one, so this is its
 * analog band-pass, s / (s² + s / Q + 1), read through the bilinear map at the
 * rate it runs.
 */
export function wahCurve(state: WahState, bandHz: number, sampleRate = 48_000) {
  const { dry, output, q, wet } = wahSettings(state);
  const at = Math.tan(
    (Math.PI * Math.min(bandHz, 0.49 * sampleRate)) / sampleRate
  );
  return (hz: number) => {
    const omega =
      Math.tan((Math.PI * Math.min(hz, 0.49 * sampleRate)) / sampleRate) / at;
    const real = 1 - omega * omega;
    const imaginary = omega / q;
    const power = real * real + imaginary * imaginary;
    // The band-pass, jΩ / (1 - Ω² + jΩ/Q), mixed with the clean sound.
    const band = {
      im: (omega * real) / power,
      re: (omega * imaginary) / power,
    };
    const re = dry + wet * band.re;
    const im = wet * band.im;
    return 20 * Math.log10(Math.max(1e-9, output * Math.hypot(re, im)));
  };
}

/**
 * The source of the wah's `AudioWorklet`, processor `audioui-wah`: the
 * auto-wah of `@audio/effect-autowah` and the wah of `@audio/effect-wah`,
 * per channel, the same band-pass moved by an envelope, by an oscillator, or
 * held. It plays all three, one output each in the order of `WAH_MODES`, the
 * band alone, so the engine fades between them without a click. Its
 * parameters are the frequency, the range, the resonance, the attack and
 * release, the sensitivity, the rate and the depth. With nothing coming in it
 * rings out until it is quiet.
 */
export const WAH_WORKLET = `${WAH_KERNELS}
/** With nothing coming in, the bands ring out until they have been this long quiet. */
const QUIET_SECONDS = 0.5;
const SILENT = 1e-6;

class AudioUiWah extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "frequency", defaultValue: 400, minValue: 20, maxValue: 20000, automationRate: "k-rate" },
      { name: "range", defaultValue: 3000, minValue: 0, maxValue: 20000, automationRate: "k-rate" },
      { name: "q", defaultValue: 5, minValue: 0.1, maxValue: 40, automationRate: "k-rate" },
      { name: "attack", defaultValue: 0.002, minValue: 0.0001, maxValue: 1, automationRate: "k-rate" },
      { name: "release", defaultValue: 0.1, minValue: 0.001, maxValue: 5, automationRate: "k-rate" },
      { name: "sensitivity", defaultValue: 2, minValue: 0, maxValue: 20, automationRate: "k-rate" },
      { name: "rate", defaultValue: 1.5, minValue: 0, maxValue: 100, automationRate: "k-rate" },
      { name: "depth", defaultValue: 0.8, minValue: 0, maxValue: 6, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.states = [[], [], []];
    this.quiet = 0;
    this.silence = new Float32Array(0);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const coming = input && input.length > 0;
    if (!coming && this.quiet >= QUIET_SECONDS * sampleRate) {
      return true;
    }
    const frames = outputs[0][0].length;
    if (this.silence.length < frames) {
      this.silence = new Float32Array(frames);
    }
    let loudest = 0;
    for (let mode = 0; mode < 3; mode += 1) {
      const output = outputs[mode];
      for (let channel = 0; channel < output.length; channel += 1) {
        // Nothing coming in: the band still rings out, fed silence.
        const sound = coming ? (input[channel] ?? input[0]) : this.silence.subarray(0, frames);
        const data = output[channel];
        data.set(sound);
        this.states[mode][channel] ??= { fs: sampleRate };
        const state = this.states[mode][channel];
        state.Q = parameters.q[0];
        if (mode === 0) {
          state.base = parameters.frequency[0];
          state.range = parameters.range[0];
          state.attack = parameters.attack[0];
          state.release = parameters.release[0];
          state.sens = parameters.sensitivity[0];
          autoWah(data, state);
        } else {
          state.fc = parameters.frequency[0];
          state.rate = parameters.rate[0];
          state.depth = parameters.depth[0];
          state.mode = mode === 1 ? "auto" : "manual";
          wah(data, state);
        }
        for (let frame = 0; frame < frames; frame += 1) {
          loudest = Math.max(loudest, Math.abs(data[frame]));
        }
      }
    }
    this.quiet = coming || loudest > SILENT ? 0 : this.quiet + frames;
    return true;
  }
}
registerProcessor("audioui-wah", AudioUiWah);
`;
