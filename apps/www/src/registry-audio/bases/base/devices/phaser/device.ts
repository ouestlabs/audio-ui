import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/core/time";
import { PHASER_KERNELS } from "@/registry-audio/bases/base/devices/phaser/kernels";
import {
  lfoRate,
  SYNCED_RATE_PARAMETERS,
} from "@/registry-audio/bases/base/lib/synced-rate";

/** The all-pass stages of the phaser: each pair makes one notch. */
export const PHASER_STAGES = 4;
const MAX_SWEEP_OCTAVES = 3;
const MAX_FLANGER_SWEEP_MS = 4;

/**
 * A phaser and flanger as a device: a slow oscillator sweeps either a chain of
 * all-pass filters (the phaser, or the classic phaser's first-order stages) or
 * a short delay (the flanger), with feedback and a mix, and no panel and no
 * audio in it.
 */
export const phaserDevice = defineDevice({
  description:
    "Sweeps notches through the sound: in phaser mode a chain of all-pass filters around a centre frequency, in classic mode 2 to 12 first-order stages swept in a straight line, in flanger mode a very short delay, moved by a slow oscillator, with feedback and a mix.",
  id: "audioui.phaser",
  name: "Phaser-Flanger",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "phaser",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Phaser", value: "phaser" },
        { label: "Classic", value: "classic" },
        { label: "Flanger", value: "flanger" },
      ],
    },
    {
      default: 0.4,
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
      default: 60,
      id: "depth",
      label: "Depth",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 1200,
      format: formatHz,
      id: "centerHz",
      label: "Center",
      max: 8000,
      min: 200,
      scale: "log",
      step: 10,
    },
    {
      default: 3,
      id: "delayMs",
      label: "Delay",
      max: 10,
      min: 0.5,
      step: 0.1,
      unit: "ms",
    },
    {
      default: 4,
      id: "stages",
      label: "Stages",
      max: 12,
      min: 2,
      step: 2,
    },
    {
      default: 40,
      id: "feedback",
      label: "Feedback",
      max: 90,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 50,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type PhaserState = DeviceState<typeof phaserDevice.parameters>;

/**
 * The numbers that go on the nodes for a state. The sweep is an octave range
 * for the phaser (a share of three octaves, as a number of cents the
 * oscillator adds to each stage), a share of the centre for the classic
 * phaser, which sweeps in a straight line, and a time for the flanger, kept
 * inside the delay so it never goes negative.
 */
export function phaserSettings(
  state: PhaserState,
  tempo: Tempo = DEFAULT_TEMPO
) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    classicDepth: state.depth / 100,
    classicWet: state.mode === "classic" ? mix : 0,
    delay: state.delayMs / 1000,
    dry: 1 - mix,
    feedback: state.feedback / 100,
    flangerSweep:
      Math.min(
        state.delayMs - 0.25,
        (MAX_FLANGER_SWEEP_MS * state.depth) / 100
      ) / 1000,
    flangerWet: state.mode === "flanger" ? mix : 0,
    phaserSweepCents: ((MAX_SWEEP_OCTAVES * 1200) / 2) * (state.depth / 100),
    phaserWet: state.mode === "phaser" ? mix : 0,
    rate: lfoRate(state, tempo),
    stages: state.stages,
    center: state.centerHz,
  };
}

/** What the oscillator does to the swept value, from -100 % to 100 % of the depth, at `seconds`. */
export function phaserSweep(state: PhaserState, tempo: Tempo = DEFAULT_TEMPO) {
  return (seconds: number) =>
    state.depth * Math.sin(2 * Math.PI * lfoRate(state, tempo) * seconds);
}

/**
 * The source of the classic phaser's `AudioWorklet`, processor
 * `audioui-phaser`: the phaser of `@audio/effect-phaser`, a cascade of
 * first-order all-pass stages swept by its own oscillator, with its feedback,
 * per channel. Its parameters are the oscillator's rate, the depth (a share of
 * the centre), the centre, the feedback and the stages. A new count of stages
 * waits for the knob to rest, then fades in on a fresh cascade, its oscillator
 * where the old one was. It plays the wet sound alone, and with nothing coming
 * in it rings out until it is quiet.
 */
export const PHASER_WORKLET = `${PHASER_KERNELS}
const REST_SECONDS = 0.12;
const FADE_SECONDS = 0.08;
/** With nothing coming in, the stages ring out until they have been this long quiet. */
const QUIET_SECONDS = 1;
const SILENT = 1e-6;

/** A cascade of stages per channel, its oscillator at \`phase\`. */
function cascadeOf(stages, phase) {
  return { stages, states: [0, 1].map(() => ({ _phase: phase, fs: sampleRate, stages })) };
}

class AudioUiPhaser extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rate", defaultValue: 0.4, minValue: 0, maxValue: 100, automationRate: "k-rate" },
      { name: "depth", defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "fc", defaultValue: 1200, minValue: 20, maxValue: 20000, automationRate: "k-rate" },
      { name: "feedback", defaultValue: 0.4, minValue: 0, maxValue: 0.95, automationRate: "k-rate" },
      { name: "stages", defaultValue: 4, minValue: 2, maxValue: 12, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.cascade = null;
    this.leaving = null;
    this.target = 0;
    this.resting = 0;
    this.quiet = 0;
    this.scratch = [];
  }
  /** One cascade's wet sound for a block, into \`out\`, from the sound's \`left\` and \`right\`. */
  run(cascade, left, right, out, parameters) {
    const inputs = [left, right];
    for (let channel = 0; channel < 2; channel += 1) {
      const state = cascade.states[channel];
      const data = out[channel];
      data.set(inputs[channel]);
      state.rate = parameters.rate[0];
      state.depth = parameters.depth[0];
      state.fc = parameters.fc[0];
      state.feedback = parameters.feedback[0];
      phaser(data, state);
      // It plays half the sound and half the stages: twice that, less the sound, is the stages.
      for (let frame = 0; frame < data.length; frame += 1) {
        data[frame] = 2 * data[frame] - inputs[channel][frame];
      }
    }
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(output && output.length > 0)) {
      return true;
    }
    const frames = output[0].length;
    if (!this.scratch[0] || this.scratch[0].length < frames) {
      this.scratch = [new Float32Array(frames), new Float32Array(frames), new Float32Array(frames), new Float32Array(frames)];
    }
    const coming = input && input.length > 0;
    if (!coming && this.quiet >= QUIET_SECONDS * sampleRate) {
      return true;
    }
    // Nothing coming in: the stages still ring out, fed silence.
    const silence = this.scratch[3].subarray(0, frames);
    const left = coming ? input[0] : silence;
    const right = coming ? (input[1] ?? input[0]) : silence;
    const stages = Math.round(parameters.stages[0] / 2) * 2;
    const out = output.length > 1 ? output : [output[0], this.scratch[0].subarray(0, frames)];
    if (!this.cascade) {
      this.cascade = cascadeOf(stages, 0);
    }
    // A new count of stages, once the knob has stood still long enough.
    this.resting = stages === this.target ? this.resting + frames : 0;
    this.target = stages;
    if (!this.leaving && stages !== this.cascade.stages && this.resting >= REST_SECONDS * sampleRate) {
      const fade = Math.round(FADE_SECONDS * sampleRate);
      this.leaving = { cascade: this.cascade, left: fade, total: fade };
      this.cascade = cascadeOf(stages, this.cascade.states[0]._phase);
    }
    this.run(this.cascade, left, right, out, parameters);
    if (this.leaving) {
      const old = [this.scratch[1].subarray(0, frames), this.scratch[2].subarray(0, frames)];
      this.run(this.leaving.cascade, left, right, old, parameters);
      for (let frame = 0; frame < frames; frame += 1) {
        // An equal-power fade: the two hardly correlate, so their powers add.
        const share = (Math.max(0, this.leaving.left - frame) / this.leaving.total) * Math.PI / 2;
        const going = Math.sin(share);
        const coming = Math.cos(share);
        out[0][frame] = out[0][frame] * coming + old[0][frame] * going;
        out[1][frame] = out[1][frame] * coming + old[1][frame] * going;
      }
      this.leaving.left -= frames;
      if (this.leaving.left <= 0) {
        this.leaving = null;
      }
    }
    let loudest = 0;
    for (let frame = 0; frame < frames; frame += 1) {
      loudest = Math.max(loudest, Math.abs(out[0][frame]), Math.abs(out[1][frame]));
    }
    this.quiet = coming || loudest > SILENT ? 0 : this.quiet + frames;
    return true;
  }
}
registerProcessor("audioui-phaser", AudioUiPhaser);
`;
