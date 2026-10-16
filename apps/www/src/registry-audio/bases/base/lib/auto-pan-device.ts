import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/core/time";
import {
  lfoRate,
  SYNCED_RATE_PARAMETERS,
} from "@/registry-audio/bases/base/lib/synced-rate";

/**
 * An auto pan and tremolo as a device: a slow oscillator moves the sound
 * between the speakers (pan) or its level up and down (tremolo), and no panel
 * and no audio in it.
 */
export const autoPanDevice = defineDevice({
  description:
    "Moves the sound with a slow oscillator: in pan mode from one speaker to the other, in tremolo mode its level up and down, at a rate, a depth and a waveform.",
  id: "audioui.auto-pan",
  name: "Auto Pan",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "pan",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Pan", value: "pan" },
        { label: "Tremolo", value: "tremolo" },
      ],
    },
    {
      default: "sine",
      id: "shape",
      kind: "choice",
      label: "Shape",
      options: [
        { label: "Sine", value: "sine" },
        { label: "Triangle", value: "triangle" },
        { label: "Saw", value: "sawtooth" },
        { label: "Square", value: "square" },
      ],
    },
    {
      default: 1,
      id: "rateHz",
      label: "Rate",
      max: 20,
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
  ],
});

export type AutoPanState = DeviceState<typeof autoPanDevice.parameters>;

/** The numbers that go on the nodes for a state. Off, there is no movement. */
export function autoPanSettings(
  state: AutoPanState,
  tempo: Tempo = DEFAULT_TEMPO
) {
  const depth = state.enabled ? state.depth / 100 : 0;
  const pan = state.mode === "pan";
  return {
    // The oscillator swings from -1 to 1: it moves the pan by the depth, or the level by half of it around its middle.
    panDepth: pan ? depth : 0,
    rate: lfoRate(state, tempo),
    tremoloBase: state.mode === "tremolo" ? 1 - depth / 2 : 1,
    tremoloDepth: state.mode === "tremolo" ? depth / 2 : 0,
  };
}

/** The oscillator at `phase` cycles, from -1 to 1, as its shape draws it. */
export function autoPanWave(shape: AutoPanState["shape"], phase: number) {
  const cycle = phase - Math.floor(phase);
  if (shape === "square") {
    return cycle < 0.5 ? 1 : -1;
  }
  if (shape === "sawtooth") {
    // A ramp up from -1 to 1, then back at once, as the node's own sawtooth.
    return 2 * cycle - 1;
  }
  if (shape === "triangle") {
    return cycle < 0.5 ? 4 * cycle - 1 : 3 - 4 * cycle;
  }
  return Math.sin(2 * Math.PI * cycle);
}

/** What is moved, from -100 to 100 %, at `seconds`: the pan, or the level around its middle. */
export function autoPanSweep(
  state: AutoPanState,
  tempo: Tempo = DEFAULT_TEMPO
) {
  return (seconds: number) =>
    state.depth * autoPanWave(state.shape, lfoRate(state, tempo) * seconds);
}
