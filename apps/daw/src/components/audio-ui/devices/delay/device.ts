import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import {
  DEFAULT_TEMPO,
  SYNCED_DIVISIONS,
  syncedSeconds,
  type Tempo,
} from "@audio-ui/core/time";
import { DELAY_KERNELS } from "@/components/audio-ui/devices/delay/kernels";

/** The longest echo time, in seconds: the node that holds it is made this long. */
export const MAX_DELAY_SECONDS = 2;
const MAX_FEEDBACK = 0.95;
/** An echo quieter than this share of the first is not drawn. */
const AUDIBLE_SHARE = 0.03;

/**
 * A delay as a device: a mode, an echo time (in milliseconds, or a note value
 * that follows the host's tempo), how much of each echo comes back, how dark
 * the repeats get, a mix, and the grain delay's pitch, spray, jitter and grain
 * size, with no panel and no audio in it. A panel draws its state, an engine
 * plays it, an agent drives it through `deviceTools(delayDevice)`.
 */
export const delayDevice = defineDevice({
  description:
    "Repeats the sound: an echo after the time, or after a note value of the host's tempo when it is synced, each repeat a share of the one before it (the feedback) and darker as the tone closes, mixed with the dry sound. Its mode is a plain echo, a ping-pong whose echoes bounce from side to side, a multitap of two taps, or a grain delay whose echoes are grains, transposed and scattered.",
  id: "audioui.delay",
  name: "Delay",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "echo",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Echo", value: "echo" },
        { label: "Ping-pong", value: "pingpong" },
        { label: "Multitap", value: "multitap" },
        { label: "Grain", value: "grain" },
      ],
    },
    {
      default: 350,
      id: "timeMs",
      label: "Time",
      max: MAX_DELAY_SECONDS * 1000,
      min: 10,
      scale: "log",
      step: 1,
      unit: "ms",
    },
    { default: false, id: "sync", kind: "toggle", label: "Sync" },
    {
      default: "1/8",
      id: "division",
      kind: "choice",
      label: "Note",
      options: SYNCED_DIVISIONS,
    },
    {
      default: 40,
      id: "feedback",
      label: "Feedback",
      max: MAX_FEEDBACK * 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 6000,
      format: formatHz,
      id: "toneHz",
      label: "Tone",
      max: 20_000,
      min: 200,
      scale: "log",
      step: 10,
    },
    {
      default: 30,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 0,
      id: "pitch",
      label: "Pitch",
      max: 24,
      min: -24,
      step: 1,
      unit: "st",
    },
    {
      default: 20,
      id: "sprayMs",
      label: "Spray",
      max: 100,
      min: 0,
      step: 1,
      unit: "ms",
    },
    {
      default: 0,
      id: "jitter",
      label: "Jitter",
      max: 12,
      min: 0,
      step: 0.1,
      unit: "st",
    },
    {
      default: 80,
      id: "grainMs",
      label: "Grain",
      max: 300,
      min: 10,
      scale: "log",
      step: 1,
      unit: "ms",
    },
  ],
});

export type DelayState = DeviceState<typeof delayDevice.parameters>;
export type DelayMode = DelayState["mode"];

/** What only the grain delay has: shown with it alone. */
export const GRAIN_PARAMETERS = [
  "pitch",
  "sprayMs",
  "jitter",
  "grainMs",
] as const;

/**
 * The multitap's two taps for an echo time: the kernel's own pattern, half
 * the time at half the level and the whole time at three tenths, scaled so
 * its last tap falls on the time.
 */
export const multitapTaps = (seconds: number) => [
  { gain: 0.5, time: seconds / 2 },
  { gain: 0.3, time: seconds },
];

/** The echo time of a state in seconds: the note value at the tempo when it is synced, else the milliseconds, and never more than the node can hold. */
export function delaySeconds(state: DelayState, tempo: Tempo = DEFAULT_TEMPO) {
  const seconds = state.sync
    ? syncedSeconds(state.division, tempo)
    : state.timeMs / 1000;
  return Math.min(MAX_DELAY_SECONDS, seconds);
}

/** The note value whose length at `tempo` is closest to `seconds`: where a handle dragged to a time lands when the delay is synced. */
export function nearestDivision(seconds: number, tempo: Tempo = DEFAULT_TEMPO) {
  let best = SYNCED_DIVISIONS[0]?.value ?? "1/8";
  let gap = Number.POSITIVE_INFINITY;
  for (const { value } of SYNCED_DIVISIONS) {
    const distance = Math.abs(syncedSeconds(value, tempo) - seconds);
    if (distance < gap) {
      gap = distance;
      best = value;
    }
  }
  return best;
}

/**
 * The numbers that go on the nodes for a state, as plain values. Pure, so what
 * an engine sets can be read and tested without an `AudioContext`. Off, the
 * echo is silent and nothing comes back, so what was ringing dies out.
 */
export function delaySettings(state: DelayState, tempo: Tempo = DEFAULT_TEMPO) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    delay: delaySeconds(state, tempo),
    dry: 1 - mix,
    feedback: state.enabled ? state.feedback / 100 : 0,
    grain: state.grainMs / 1000,
    jitter: state.jitter,
    mode: state.mode,
    pitch: state.pitch,
    spray: state.sprayMs / 1000,
    tone: state.toneHz,
    wet: mix,
  };
}

/** One echo as the plot draws it: when it sounds, and how loud it is next to the dry sound. */
export interface DelayTap {
  level: number;
  timeMs: number;
}

/**
 * The echoes a state makes within `windowMs`: the dry sound at 0, then each
 * repeat at a multiple of the time, a `feedback` share quieter than the one
 * before, until it is too quiet to draw. The first echo is as loud as the mix.
 * A ping-pong's alternate sides, and a grain delay's are transposed grains, at
 * the same times. A multitap's fall every half time: its two taps and what
 * they send back.
 */
export function delayTaps(
  state: DelayState,
  windowMs: number,
  tempo: Tempo = DEFAULT_TEMPO
): DelayTap[] {
  const { delay, dry, feedback, mode, wet } = delaySettings(state, tempo);
  const timeMs = delay * 1000;
  const taps: DelayTap[] = [{ level: dry, timeMs: 0 }];
  if (mode === "multitap") {
    // Every half time, what the two taps read of the line, and what goes back in.
    const [near, far] = multitapTaps(1).map((tap) => tap.gain);
    const fed = [1];
    for (let n = 1; (n * timeMs) / 2 <= windowMs && wet > 0; n += 1) {
      const echo =
        (near ?? 0) * (fed[n - 1] ?? 0) + (far ?? 0) * (fed[n - 2] ?? 0);
      fed.push(feedback * echo);
      if (echo >= (near ?? 0) * AUDIBLE_SHARE) {
        taps.push({ level: echo * wet, timeMs: (n * timeMs) / 2 });
      }
    }
    return taps;
  }
  let level = wet;
  for (
    let n = 1;
    n * timeMs <= windowMs && level >= wet * AUDIBLE_SHARE && level > 0;
    n += 1
  ) {
    taps.push({ level, timeMs: n * timeMs });
    level *= feedback;
  }
  return taps;
}

/**
 * The delay modes made of audio.js kernels, for an `AudioWorklet`: a
 * ping-pong (the sound's middle goes in on the left, so its echoes bounce),
 * a multitap of `multitapTaps`, and a grain delay, wet only, at the time,
 * the feedback and the grain parameters of its `AudioParam`s, 128 frames at
 * a time. A multitap's and a grain delay's lines are made as long as the
 * longest settings need, so their time glides and their grains follow at
 * once. A ping-pong's line is the length of its time: a new time waits for
 * the knob to rest, then fades in on a fresh line as the old one fades out,
 * as does a change of mode.
 */
export const DELAY_WORKLET = `${DELAY_KERNELS}
const LONGEST = ${MAX_DELAY_SECONDS};
const REST_SECONDS = 0.12;
const FADE_SECONDS = 0.08;
const GLIDE_SECONDS = 0.08;
/** With nothing coming in, the echoes ring out, until the line has been this long quiet: longer than any echo takes to come back. */
const QUIET_SECONDS = LONGEST + 1;
const SILENT = 1e-6;
const SEEDS = [0x9e3779b9, 0x2545f491];

/**
 * A line of a mode at a time: its state per channel, its buffers as long as
 * the longest settings need. A grain delay's is made at its own grain, which
 * sets its heads apart by half a grain, and a second more of time: room for
 * any grain to come.
 */
function lineOf(mode, time, grain) {
  const line = { mode, states: [], taps: [[{ gain: 0.5, time: time / 2 }, { gain: 0.3, time }], [{ gain: 0.5, time: time / 2 }, { gain: 0.3, time }]], time, which: 0 };
  for (let channel = 0; channel < 2; channel += 1) {
    const state = { fs: sampleRate, mix: 1, seed: SEEDS[channel], time };
    if (mode === "multitap") {
      state.taps = [{ gain: 0, time: LONGEST }];
      multitap(new Float32Array(0), state);
      state.taps = line.taps[0];
    } else if (mode === "grain") {
      Object.assign(state, { grain, jitter: 12, pitch: 24, spray: 0.1, time: LONGEST + 1 });
      graindelay(new Float32Array(0), state);
    }
    line.states.push(state);
  }
  return line;
}

class AudioUiDelay extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "time", defaultValue: 0.35, minValue: 0.001, maxValue: LONGEST, automationRate: "k-rate" },
      { name: "feedback", defaultValue: 0.4, minValue: 0, maxValue: 0.95, automationRate: "k-rate" },
      { name: "pitch", defaultValue: 0, minValue: -24, maxValue: 24, automationRate: "k-rate" },
      { name: "spray", defaultValue: 0.02, minValue: 0, maxValue: 0.1, automationRate: "k-rate" },
      { name: "jitter", defaultValue: 0, minValue: 0, maxValue: 12, automationRate: "k-rate" },
      { name: "grain", defaultValue: 0.08, minValue: 0.01, maxValue: 0.3, automationRate: "k-rate" },
    ];
  }
  constructor(options) {
    super();
    this.mode = options.processorOptions.mode;
    this.line = null;
    this.leaving = null;
    this.target = 0;
    this.resting = 0;
    this.grain = 0.08;
    this.quiet = 0;
    this.scratch = [];
    this.port.onmessage = ({ data }) => {
      if (data.mode !== this.mode) {
        this.mode = data.mode;
        this.replace(this.line ? this.line.time : 0.35, this.grain);
      }
    };
  }
  /** A fresh line takes over, the one that played fading out. */
  replace(time, grain) {
    if (this.line) {
      const frames = Math.round(FADE_SECONDS * sampleRate);
      this.leaving = { left: frames, line: this.line, total: frames };
    }
    this.line = lineOf(this.mode, time, grain);
  }
  /** One line's wet sound for a block, into \`out\`, from the sound's \`left\` and \`right\`. */
  run(line, left, right, out, parameters, time) {
    const feedback = parameters.feedback[0];
    const frames = out[0].length;
    if (line.mode === "pingpong") {
      const state = line.states[0];
      state.feedback = feedback;
      for (let frame = 0; frame < frames; frame += 1) {
        out[0][frame] = (left[frame] + right[frame]) / 2;
        out[1][frame] = 0;
      }
      pingPong(out[0], out[1], state);
      return;
    }
    if (line.mode === "multitap") {
      // The taps glide to the time, a block at a time.
      line.time += (time - line.time) * (1 - Math.exp(-frames / (GLIDE_SECONDS * sampleRate)));
      line.which = 1 - line.which;
      const taps = line.taps[line.which];
      taps[0].time = line.time / 2;
      taps[1].time = line.time;
    }
    const inputs = [left, right];
    for (let channel = 0; channel < 2; channel += 1) {
      const state = line.states[channel];
      const data = out[channel];
      data.set(inputs[channel]);
      state.feedback = feedback;
      if (line.mode === "multitap") {
        state.taps = line.taps[line.which];
        multitap(data, state);
        // It adds its taps to the sound: what it adds is the wet.
        for (let frame = 0; frame < frames; frame += 1) {
          data[frame] -= inputs[channel][frame];
        }
      } else {
        state.time = time;
        state.pitch = parameters.pitch[0];
        state.spray = parameters.spray[0];
        state.jitter = parameters.jitter[0];
        state.grain = parameters.grain[0];
        graindelay(data, state);
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
    // Nothing coming in: the line still rings out, fed silence.
    const silence = this.scratch[3].subarray(0, frames);
    const left = coming ? input[0] : silence;
    const right = coming ? (input[1] ?? input[0]) : silence;
    const time = parameters.time[0];
    this.grain = parameters.grain[0];
    const out = output.length > 1 ? output : [output[0], this.scratch[0].subarray(0, frames)];
    if (!this.line) {
      this.line = lineOf(this.mode, time, this.grain);
    }
    // A ping-pong's new time, once the knob has stood still long enough.
    this.resting = time === this.target ? this.resting + frames : 0;
    this.target = time;
    if (
      this.line.mode === "pingpong" &&
      !this.leaving &&
      Math.abs(this.line.time - time) * sampleRate >= 1 &&
      this.resting >= REST_SECONDS * sampleRate
    ) {
      this.replace(time, this.grain);
    }
    this.run(this.line, left, right, out, parameters, time);
    if (this.leaving) {
      const { line, total } = this.leaving;
      const old = [this.scratch[1].subarray(0, frames), this.scratch[2].subarray(0, frames)];
      this.run(line, left, right, old, parameters, line.time);
      for (let frame = 0; frame < frames; frame += 1) {
        const share = Math.max(0, this.leaving.left - frame) / total;
        out[0][frame] = out[0][frame] * (1 - share) + old[0][frame] * share;
        out[1][frame] = out[1][frame] * (1 - share) + old[1][frame] * share;
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
registerProcessor("audioui-delay", AudioUiDelay);
`;