import { formatHz } from "@audio-ui/engine/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import {
  dattorro,
  fdn,
  freeverb,
  schroeder,
  spring,
} from "@audio-ui/engine/dsp";

/** The level a tail has fallen to when its decay time is over, in dB: what "decay time" means in a room. */
export const DECAY_DB = -60;
const NATURAL_LOG_OF_1000 = Math.log(1000);

/**
 * A reverb as a device: the kind of room, how long the tail lasts, how long
 * before it starts, how dark it is and a mix, with no panel and no audio in
 * it. A panel draws its state, an engine plays it, an agent drives it through
 * `deviceTools(reverbDevice)`.
 */
export const reverbDevice = defineDevice({
  description:
    "Puts the sound in a room of a type, a room, a plate, a hall, a spring, a Freeverb or a Schroeder: a tail that dies away over the decay time, starting after a pre-delay, darker as the damping closes, mixed with the dry sound.",
  id: "audioui.reverb",
  name: "Reverb",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "room",
      id: "type",
      kind: "choice",
      label: "Type",
      options: [
        { label: "Room", value: "room" },
        { label: "Plate", value: "plate" },
        { label: "Hall", value: "hall" },
        { label: "Spring", value: "spring" },
        { label: "Freeverb", value: "freeverb" },
        { label: "Schroeder", value: "schroeder" },
      ],
    },
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
export type ReverbType = ReverbState["type"];

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

/** A feedback gain that falls by 60 dB over `decay` seconds, for a loop `k` long: `10^(-k / decay)`, `k` measured on each algorithm. */
const feedback = (k: number, decay: number) => 10 ** (-k / decay);
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How each type other than the room rings a sound, in place, for a decay
 * time, wet only, and the shortest decay it rings by itself, in seconds.
 * Their feedback follows the decay time as measured on each, its own damping
 * left open: the damping is the low-pass on what goes in. A spring and a
 * Schroeder ring in mono, as they were built.
 */
const RINGS: Record<
  Exclude<ReverbType, "room">,
  {
    ring: (
      channels: [Float32Array, Float32Array],
      decay: number,
      fs: number
    ) => void;
    shortest: number;
  }
> = {
  freeverb: {
    // Its feedback is 0.7 + 0.28 * room.
    ring: (channels, decay, fs) =>
      freeverb(channels, {
        damp: 0,
        fs,
        mix: 1,
        room: clamp((feedback(0.099, decay) - 0.7) / 0.28),
      }),
    shortest: 0.64,
  },
  hall: {
    ring: (channels, decay, fs) =>
      fdn(channels, { damping: 0, fs, mix: 1, t60: decay }),
    shortest: 0,
  },
  plate: {
    ring: (channels, decay, fs) =>
      dattorro(channels, {
        bandwidth: 1,
        damping: 0,
        decay: clamp(feedback(0.6, decay)),
        fs,
        mix: 1,
      }),
    shortest: 0.54,
  },
  schroeder: {
    ring: ([left, right], decay, fs) => {
      schroeder(left, {
        damping: 0,
        decay: feedback(0.097, decay),
        fs,
        mix: 1,
      });
      right.set(left);
    },
    shortest: 0,
  },
  spring: {
    // Its feedback is 0.55 + 0.42 * decay.
    ring: ([left, right], decay, fs) => {
      spring(left, {
        damping: 0,
        decay: clamp((feedback(0.123, decay) - 0.55) / 0.42),
        fs,
        mix: 1,
      });
      right.set(left);
    },
    shortest: 0.49,
  },
};

/**
 * The impulse response of a room for a state, as long as the decay time and
 * falling by 60 dB over it, through a one-pole low-pass at the damping
 * frequency. The room is noise that dies exponentially, two channels of
 * different noise so the tail has width; `random` is `Math.random` unless a
 * test gives its own. Every other type is its own algorithm rung by a click:
 * the same room every time, and below the shortest decay it rings, brought
 * down to the decay time along the same exponential.
 */
export function reverbImpulse(
  sampleRate: number,
  state: Pick<ReverbState, "dampingHz" | "decay"> & { type?: ReverbType },
  random: () => number = Math.random
): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const length = Math.max(1, Math.round(state.decay * sampleRate));
  const pole = Math.exp((-2 * Math.PI * state.dampingHz) / sampleRate);
  const channel = () => new Float32Array(new ArrayBuffer(length * 4));
  const type = state.type ?? "room";
  if (type === "room") {
    const noise = () => {
      const data = channel();
      let previous = 0;
      for (let index = 0; index < length; index += 1) {
        const envelope = Math.exp((-NATURAL_LOG_OF_1000 * index) / length);
        previous = (1 - pole) * (random() * 2 - 1) * envelope + pole * previous;
        data[index] = previous;
      }
      return data;
    };
    return [noise(), noise()];
  }
  // A click through the low-pass.
  const click = channel();
  let level = 1 - pole;
  for (let index = 0; index < length && level > 0; index += 1) {
    click[index] = level;
    level *= pole;
  }
  const room: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [
    click,
    click.slice(),
  ];
  const { ring, shortest } = RINGS[type];
  ring(room, state.decay, sampleRate);
  if (state.decay < shortest) {
    const faster =
      NATURAL_LOG_OF_1000 * (1 / state.decay - 1 / shortest) * (1 / sampleRate);
    for (const data of room) {
      for (let index = 0; index < length; index += 1) {
        data[index] = (data[index] ?? 0) * Math.exp(-faster * index);
      }
    }
  }
  return room;
}
