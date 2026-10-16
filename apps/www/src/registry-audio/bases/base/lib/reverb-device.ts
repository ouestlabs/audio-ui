import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** The level a tail has fallen to when its decay time is over, in dB: what "decay time" means in a room. */
export const DECAY_DB = -60;
const NATURAL_LOG_OF_1000 = Math.log(1000);

/**
 * A reverb as a device: how long the tail lasts, how long before it starts, how
 * dark it is and a mix, with no panel and no audio in it. A panel draws its
 * state, an engine plays it, an agent drives it through
 * `deviceTools(reverbDevice)`.
 */
export const reverbDevice = defineDevice({
  description:
    "Puts the sound in a room: a tail that dies away over the decay time, starting after a pre-delay, darker as the damping closes, mixed with the dry sound.",
  id: "audioui.reverb",
  name: "Reverb",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 2.2,
      id: "decay",
      label: "Decay",
      max: 10,
      min: 0.2,
      scale: "log",
      step: 0.1,
      unit: "s",
    },
    {
      default: 20,
      id: "preDelayMs",
      label: "Pre-delay",
      max: 200,
      min: 0,
      step: 1,
      unit: "ms",
    },
    {
      default: 7000,
      format: formatHz,
      id: "dampingHz",
      label: "Damping",
      max: 20_000,
      min: 1000,
      scale: "log",
      step: 100,
    },
    {
      default: 25,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type ReverbState = DeviceState<typeof reverbDevice.parameters>;

/** The numbers that go on the nodes for a state, as plain values. Off, the tail is silent. */
export function reverbSettings(state: ReverbState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    dry: 1 - mix,
    preDelay: state.preDelayMs / 1000,
    wet: mix,
  };
}

/**
 * The level of the tail over time, in dB from 0 down: silent until the
 * pre-delay is over, then falling in a straight line (an exponential decay is
 * a line in dB) to -60 dB at the decay time.
 */
export function reverbDecay(state: ReverbState) {
  const start = state.preDelayMs / 1000;
  return (seconds: number) =>
    seconds < start
      ? 0
      : Math.max(DECAY_DB, (DECAY_DB * (seconds - start)) / state.decay);
}

/**
 * The impulse response of a room for a state: noise that dies exponentially to
 * -60 dB over the decay time, run through a one-pole low-pass at the damping
 * frequency. Two channels of different noise, so the tail has width. `random`
 * is `Math.random` unless a test gives its own.
 */
export function reverbImpulse(
  sampleRate: number,
  state: Pick<ReverbState, "dampingHz" | "decay">,
  random: () => number = Math.random
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.max(1, Math.round(state.decay * sampleRate));
  const pole = Math.exp((-2 * Math.PI * state.dampingHz) / sampleRate);
  const channel = () => {
    const data = new Float32Array(new ArrayBuffer(length * 4));
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const envelope = Math.exp((-NATURAL_LOG_OF_1000 * index) / length);
      previous = (1 - pole) * (random() * 2 - 1) * envelope + pole * previous;
      data[index] = previous;
    }
    return data;
  };
  return [channel(), channel()];
}
