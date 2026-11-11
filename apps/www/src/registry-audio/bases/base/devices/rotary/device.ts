import { formatHz } from "@audio-ui/engine/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/engine/device";
import { ROTARY_KERNELS } from "@/registry-audio/bases/base/devices/rotary/kernels";

/**
 * How fast the horn and the drum turn at each speed, in turns a second: the
 * classic cabinet's slow and fast rates, as `@audio/effect-rotary` has them,
 * and still.
 */
export const ROTOR_SPEEDS = {
  fast: { drum: 5.9, horn: 6.7 },
  slow: { drum: 0.7, horn: 0.8 },
  stop: { drum: 0, horn: 0 },
} as const;

/**
 * A rotary speaker as a device: a horn and a drum turning past two
 * microphones, slow, fast or stopped, each winding up to its speed, with no
 * panel and no audio in it.
 */
export const rotaryDevice = defineDevice({
  description:
    "Spins the sound in a rotary speaker: the highs from a turning horn, the lows from a turning drum, split at a crossover, each sweeping its pitch and level past two microphones. Slow, fast or stopped, the heavy drum winding up slower than the horn.",
  id: "audioui.rotary",
  name: "Rotary",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "slow",
      id: "speed",
      kind: "choice",
      label: "Speed",
      options: [
        { label: "Slow", value: "slow" },
        { label: "Fast", value: "fast" },
        { label: "Stop", value: "stop" },
      ],
    },
    {
      default: 800,
      format: formatHz,
      id: "crossoverHz",
      label: "Crossover",
      max: 3000,
      min: 200,
      scale: "log",
      step: 1,
    },
    {
      default: 100,
      id: "depth",
      label: "Depth",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 0.6,
      id: "hornRampS",
      label: "Horn ramp",
      max: 3,
      min: 0.05,
      scale: "log",
      step: 0.01,
      unit: "s",
    },
    {
      default: 2.5,
      id: "drumRampS",
      label: "Drum ramp",
      max: 6,
      min: 0.05,
      scale: "log",
      step: 0.01,
      unit: "s",
    },
    {
      default: 90,
      format: (degrees: number) => `${Math.round(degrees)}°`,
      id: "widthDeg",
      label: "Width",
      max: 180,
      min: 0,
      step: 1,
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

export type RotaryState = DeviceState<typeof rotaryDevice.parameters>;

/**
 * The numbers that go on the worklet for a state, the kernel's own: the
 * rotors' speeds and how long they take to reach them, the crossover, the
 * depth, the angle between the microphones in radians and the mix. Off,
 * nothing is mixed in and the kernel lets the sound through as it is.
 */
export function rotarySettings(state: RotaryState) {
  const speeds = ROTOR_SPEEDS[state.speed];
  return {
    crossover: state.crossoverHz,
    depth: state.depth / 100,
    drumInertia: state.drumRampS,
    drumSpeed: speeds.drum,
    hornInertia: state.hornRampS,
    hornSpeed: speeds.horn,
    micSpread: (state.widthDeg * Math.PI) / 180,
    mix: state.enabled ? state.mix / 100 : 0,
  };
}

/**
 * The two bands of a state, in dB at each frequency: the drum's under the
 * crossover and the horn's over it, the fourth-order Linkwitz-Riley split the
 * kernel makes, which sums back to flat.
 */
export function rotaryBands(state: RotaryState) {
  const at = state.crossoverHz;
  const share = (hz: number) => (hz / at) ** 4;
  return {
    drum: (hz: number) => -20 * Math.log10(1 + share(hz)),
    horn: (hz: number) =>
      20 * Math.log10(Math.max(1e-9, share(hz) / (1 + share(hz)))),
  };
}

/**
 * The source of the rotary's `AudioWorklet`, processor `audioui-rotary`: the
 * rotary speaker of `@audio/effect-rotary`, with the crossover of
 * `@audio/eq-crossover` it splits the sound with, a mono cabinet heard in
 * stereo. Its parameters are the kernel's own.
 */
export const ROTARY_WORKLET = `${ROTARY_KERNELS}
const NAMES = ["hornSpeed", "drumSpeed", "crossover", "depth", "hornInertia", "drumInertia", "micSpread", "mix"];

class AudioUiRotary extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "hornSpeed", defaultValue: 0.8, minValue: 0, maxValue: 20, automationRate: "k-rate" },
      { name: "drumSpeed", defaultValue: 0.7, minValue: 0, maxValue: 20, automationRate: "k-rate" },
      { name: "crossover", defaultValue: 800, minValue: 50, maxValue: 10000, automationRate: "k-rate" },
      { name: "depth", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
      { name: "hornInertia", defaultValue: 0.6, minValue: 0.001, maxValue: 10, automationRate: "k-rate" },
      { name: "drumInertia", defaultValue: 2.5, minValue: 0.001, maxValue: 10, automationRate: "k-rate" },
      { name: "micSpread", defaultValue: Math.PI / 2, minValue: 0, maxValue: Math.PI, automationRate: "k-rate" },
      { name: "mix", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.state = { fs: sampleRate };
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!(input && input.length > 0 && output && output.length > 1)) {
      return true;
    }
    for (const name of NAMES) {
      this.state[name] = parameters[name][0];
    }
    output[0].set(input[0]);
    output[1].set(input[1] ?? input[0]);
    rotary(output[0], output[1], this.state);
    return true;
  }
}
registerProcessor("audioui-rotary", AudioUiRotary);
`;
