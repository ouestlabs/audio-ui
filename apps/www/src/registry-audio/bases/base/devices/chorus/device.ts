import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { CHORUS_KERNELS } from "@audio-ui/engine/kernels";
import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/engine/time";
import {
  lfoRate,
  SYNCED_RATE_PARAMETERS,
} from "@/registry-audio/bases/base/lib/synced-rate";

/**
 * A chorus as a device: a short delay swept by a slow oscillator, or up to
 * eight of them swept in turn, mixed with the dry sound, with no panel and no
 * audio in it.
 */
export const chorusDevice = defineDevice({
  description:
    "Thickens the sound: a short delay whose time is swept up and down by a slow oscillator (the rate and the depth), or up to eight voices swept in turn, mixed with the dry sound so they drift apart.",
  id: "audioui.chorus",
  name: "Chorus",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 0.8,
      id: "rateHz",
      label: "Rate",
      max: 8,
      min: 0.05,
      scale: "log",
      step: 0.05,
      unit: "Hz",
    },
    ...SYNCED_RATE_PARAMETERS,
    {
      default: 40,
      id: "depth",
      label: "Depth",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 18,
      id: "delayMs",
      label: "Delay",
      max: 40,
      min: 5,
      step: 0.5,
      unit: "ms",
    },
    {
      default: 1,
      id: "voices",
      label: "Voices",
      max: 8,
      min: 1,
      step: 1,
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

export type ChorusState = DeviceState<typeof chorusDevice.parameters>;

/** The longest sweep either side of the delay time, in milliseconds, at full depth. */
const MAX_SWEEP_MS = 8;

/**
 * The numbers that go on the nodes for a state. The sweep is kept inside the
 * delay so the time never goes negative; `share` is the sweep as a share of the
 * delay, the depth the voices take.
 */
export function chorusSettings(
  state: ChorusState,
  tempo: Tempo = DEFAULT_TEMPO
) {
  const mix = state.enabled ? state.mix / 100 : 0;
  const sweepMs = Math.min(
    state.delayMs - 1,
    (MAX_SWEEP_MS * state.depth) / 100
  );
  return {
    delay: state.delayMs / 1000,
    dry: 1 - mix,
    rate: lfoRate(state, tempo),
    share: sweepMs / state.delayMs,
    sweep: sweepMs / 1000,
    voices: state.voices,
    wet: mix,
  };
}

/**
 * The delay time of a voice in milliseconds at `seconds`, as its oscillator
 * sweeps it: what the panel draws. The voices' oscillators are spread evenly
 * around the cycle.
 */
export function chorusSweep(
  state: ChorusState,
  tempo: Tempo = DEFAULT_TEMPO,
  voice = 0
) {
  const { delay, rate, sweep, voices } = chorusSettings(state, tempo);
  const phase = (2 * Math.PI * voice) / voices;
  return (seconds: number) =>
    (delay + sweep * Math.sin(2 * Math.PI * rate * seconds + phase)) * 1000;
}

/**
 * The source of the chorus voices' `AudioWorklet`, processor
 * `audioui-chorus`: the chorus of `@audio/effect-chorus`, two to eight delays
 * read from one line, their oscillators spread around the cycle, per channel.
 * Its parameters are the oscillators' rate, the depth (a share of the delay),
 * the delay and the voices. A new delay or count of voices waits for the knob
 * to rest, then fades in on a fresh line that holds the sound the old one
 * held, the oscillators where they were. It plays the voices alone, raised by
 * the root of their count so any number plays as loud as one, and with
 * nothing coming in it rings out until it is quiet.
 */
export const CHORUS_WORKLET = `${CHORUS_KERNELS}
const REST_SECONDS = 0.12;
const FADE_SECONDS = 0.08;
/** With nothing coming in, the line plays out until it has been this long quiet. */
const QUIET_SECONDS = 1;
const SILENT = 1e-6;

/**
 * A line per channel at a delay and a count of voices. One that takes over
 * from another holds the sound the other held, so it sounds at once, and its
 * oscillators are where the other's were when there are as many.
 */
function lineOf(delay, voices, from) {
  const states = [0, 1].map((channel) => {
    const state = { delay, fs: sampleRate, voices };
    const old = from ? from.states[channel] : null;
    if (old) {
      if (old._phases.length === voices) {
        state._phases = Float64Array.from(old._phases);
      }
      // The kernel's line is written at \`ptr\`, the newest sound just before it.
      const length = Math.max(1, Math.floor(delay * 2 * sampleRate));
      const held = old.buffer.length;
      state.buffer = new Float64Array(length);
      for (let back = 1; back <= Math.min(length, held); back += 1) {
        state.buffer[length - back] = old.buffer[(old.ptr - back + held) % held];
      }
      state.ptr = 0;
    }
    return state;
  });
  return { delay, states, voices };
}

class AudioUiChorus extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rate", defaultValue: 0.8, minValue: 0, maxValue: 100, automationRate: "k-rate" },
      { name: "depth", defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "delay", defaultValue: 0.018, minValue: 0.002, maxValue: 0.05, automationRate: "k-rate" },
      { name: "voices", defaultValue: 2, minValue: 1, maxValue: 8, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.line = null;
    this.leaving = null;
    this.target = "";
    this.resting = 0;
    this.quiet = 0;
    this.scratch = [];
  }
  /** One line's voices for a block, into \`out\`, from the sound's \`left\` and \`right\`. */
  run(line, left, right, out, parameters) {
    const inputs = [left, right];
    for (let channel = 0; channel < 2; channel += 1) {
      const state = line.states[channel];
      const data = out[channel];
      data.set(inputs[channel]);
      state.rate = parameters.rate[0];
      state.depth = parameters.depth[0];
      chorus(data, state);
      // It plays half the sound and half the voices: twice that, less the
      // sound, is the voices. It averages them, and on a full sound they hardly
      // correlate, so their power adds: raised by the root of their count, any
      // number of voices plays as loud as one.
      const loudness = Math.sqrt(line.voices);
      for (let frame = 0; frame < data.length; frame += 1) {
        data[frame] = (2 * data[frame] - inputs[channel][frame]) * loudness;
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
    // Nothing coming in: the line still plays out, fed silence.
    const silence = this.scratch[3].subarray(0, frames);
    const left = coming ? input[0] : silence;
    const right = coming ? (input[1] ?? input[0]) : silence;
    const delay = parameters.delay[0];
    const voices = Math.round(parameters.voices[0]);
    const out = output.length > 1 ? output : [output[0], this.scratch[0].subarray(0, frames)];
    if (!this.line) {
      this.line = lineOf(delay, voices);
    }
    // A new delay or count of voices, once the knob has stood still long enough.
    const settings = delay + ":" + voices;
    this.resting = settings === this.target ? this.resting + frames : 0;
    this.target = settings;
    if (
      !this.leaving &&
      (delay !== this.line.delay || voices !== this.line.voices) &&
      this.resting >= REST_SECONDS * sampleRate
    ) {
      const fade = Math.round(FADE_SECONDS * sampleRate);
      this.leaving = { left: fade, line: this.line, total: fade };
      this.line = lineOf(delay, voices, this.line);
    }
    this.run(this.line, left, right, out, parameters);
    if (this.leaving) {
      const old = [this.scratch[1].subarray(0, frames), this.scratch[2].subarray(0, frames)];
      this.run(this.leaving.line, left, right, old, parameters);
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
registerProcessor("audioui-chorus", AudioUiChorus);
`;
