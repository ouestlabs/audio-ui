import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import {
  DEFAULT_TEMPO,
  SYNCED_DIVISIONS,
  syncedSeconds,
  type Tempo,
} from "@audio-ui/core/time";
import { STUTTER_KERNELS } from "@/registry-audio/bases/base/devices/stutter/kernels";

/**
 * A stutter as a device: a slice of the sound caught at the start of every
 * interval and repeated to its end, each repeat quieter by the decay, the
 * lengths in note values of the tempo, with no panel and no audio in it.
 */
export const stutterDevice = defineDevice({
  description:
    "Repeats the sound: at the start of every interval it catches a slice and plays it again and again until the interval ends, each repeat quieter by the decay, the lengths in note values of the tempo. Turning it on catches a slice at once.",
  id: "audioui.stutter",
  name: "Stutter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "1/4",
      id: "interval",
      kind: "choice",
      label: "Interval",
      options: SYNCED_DIVISIONS,
    },
    {
      default: "1/16",
      id: "slice",
      kind: "choice",
      label: "Slice",
      options: SYNCED_DIVISIONS,
    },
    {
      default: 0,
      id: "decay",
      label: "Decay",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
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

export type StutterState = DeviceState<typeof stutterDevice.parameters>;

/**
 * The numbers that go on the worklet for a state, the kernel's own: the
 * interval and the slice in seconds at `tempo`, the slice no longer than the
 * interval, the decay a share and the mix. Off, nothing is mixed in.
 */
export function stutterSettings(
  state: StutterState,
  tempo: Tempo = DEFAULT_TEMPO
) {
  const interval = syncedSeconds(state.interval, tempo);
  return {
    decay: state.decay / 100,
    interval,
    mix: state.enabled ? state.mix / 100 : 0,
    slice: Math.min(syncedSeconds(state.slice, tempo), interval),
  };
}

/**
 * One interval of a state, in beats, and what plays at each beat of it: the
 * sound itself while the slice is caught, at 1, then each repeat at the level
 * the decay leaves it. A note value is the same number of beats at any tempo.
 */
export function stutterCycle(state: StutterState) {
  const { decay, interval, slice } = stutterSettings(state, DEFAULT_TEMPO);
  const beat = syncedSeconds("1/4", DEFAULT_TEMPO);
  const slices = slice / beat;
  return {
    beats: interval / beat,
    level: (at: number) => (1 - decay) ** Math.floor(at / slices),
    slice: slices,
  };
}

/**
 * The source of the stutter's `AudioWorklet`, processor `audioui-stutter`: the
 * stutter of `@audio/effect-stutter`, per channel. Its parameters are the
 * interval and the slice in seconds, the decay and the mix. New lengths wait
 * for them to rest, then fade in on a fresh cycle; a `"trigger"` message on its
 * port starts a fresh cycle at once, catching a slice from now.
 */
export const STUTTER_WORKLET = `${STUTTER_KERNELS}
const REST_SECONDS = 0.12;
const FADE_SECONDS = 0.02;

/** A cycle per channel at an interval and a slice. */
function cycleOf(interval, slice) {
  return { interval, slice, states: [] };
}

class AudioUiStutter extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "interval", defaultValue: 0.5, minValue: 0.001, maxValue: 60, automationRate: "k-rate" },
      { name: "slice", defaultValue: 0.125, minValue: 0.001, maxValue: 60, automationRate: "k-rate" },
      { name: "decay", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.cycle = null;
    this.leaving = null;
    this.target = "";
    this.resting = 0;
    this.scratch = new Float32Array(0);
    this.port.onmessage = ({ data }) => {
      if (data === "trigger" && this.cycle) {
        this.cycle = cycleOf(this.cycle.interval, this.cycle.slice);
        this.leaving = null;
      }
    };
  }
  run(cycle, channel, sound, data, parameters) {
    cycle.states[channel] ??= { fs: sampleRate, interval: cycle.interval, slice: cycle.slice };
    const state = cycle.states[channel];
    state.decay = parameters.decay[0];
    state.mix = parameters.mix[0];
    data.set(sound);
    stutter(data, state);
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(input && input.length > 0 && output)) {
      return true;
    }
    const frames = input[0].length;
    const interval = parameters.interval[0];
    const slice = parameters.slice[0];
    if (!this.cycle) {
      this.cycle = cycleOf(interval, slice);
    }
    // New lengths, once they have stood still long enough: a change of tempo glides through many.
    const lengths = interval + ":" + slice;
    this.resting = lengths === this.target ? this.resting + frames : 0;
    this.target = lengths;
    if (
      !this.leaving &&
      (interval !== this.cycle.interval || slice !== this.cycle.slice) &&
      this.resting >= REST_SECONDS * sampleRate
    ) {
      const fade = Math.round(FADE_SECONDS * sampleRate);
      this.leaving = { cycle: this.cycle, left: fade, total: fade };
      this.cycle = cycleOf(interval, slice);
    }
    if (this.scratch.length < frames) {
      this.scratch = new Float32Array(frames);
    }
    for (let channel = 0; channel < output.length; channel += 1) {
      const sound = input[channel] ?? input[0];
      const data = output[channel];
      this.run(this.cycle, channel, sound, data, parameters);
      if (this.leaving) {
        const old = this.scratch.subarray(0, frames);
        this.run(this.leaving.cycle, channel, sound, old, parameters);
        for (let frame = 0; frame < frames; frame += 1) {
          const share = Math.max(0, this.leaving.left - frame) / this.leaving.total;
          data[frame] = data[frame] * (1 - share) + old[frame] * share;
        }
      }
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
registerProcessor("audioui-stutter", AudioUiStutter);
`;
