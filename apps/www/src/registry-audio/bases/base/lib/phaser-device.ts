import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { DEFAULT_TEMPO, type Tempo } from "@audio-ui/core/time";
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
 * all-pass filters (the phaser) or a short delay (the flanger), with feedback
 * and a mix, and no panel and no audio in it.
 */
export const phaserDevice = defineDevice({
  description:
    "Sweeps notches through the sound: in phaser mode a chain of all-pass filters around a centre frequency, in flanger mode a very short delay, moved by a slow oscillator, with feedback and a mix.",
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
 * oscillator adds to each stage) and a time for the flanger, kept inside the
 * delay so it never goes negative.
 */
export function phaserSettings(
  state: PhaserState,
  tempo: Tempo = DEFAULT_TEMPO
) {
  const mix = state.enabled ? state.mix / 100 : 0;
  const phaser = state.mode === "phaser";
  return {
    delay: state.delayMs / 1000,
    dry: 1 - mix,
    feedback: state.feedback / 100,
    flangerSweep:
      Math.min(
        state.delayMs - 0.25,
        (MAX_FLANGER_SWEEP_MS * state.depth) / 100
      ) / 1000,
    flangerWet: phaser ? 0 : mix,
    phaserSweepCents: ((MAX_SWEEP_OCTAVES * 1200) / 2) * (state.depth / 100),
    phaserWet: phaser ? mix : 0,
    rate: lfoRate(state, tempo),
    center: state.centerHz,
  };
}

/** What the oscillator does to the swept value, from -100 % to 100 % of the depth, at `seconds`. */
export function phaserSweep(state: PhaserState, tempo: Tempo = DEFAULT_TEMPO) {
  return (seconds: number) =>
    state.depth * Math.sin(2 * Math.PI * lfoRate(state, tempo) * seconds);
}
