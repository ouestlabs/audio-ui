import { type DeviceState, defineDevice } from "@audio-ui/engine/device";

/** How many equal slices a sample is cut into: a pad, or a key, each. */
export const SAMPLER_SLICES = 16;
/** The note that plays the first slice: pad 1 is note 36, as on drum pads; the notes after it play the next slices, round again after sixteen. */
export const SAMPLER_FIRST_NOTE = 36;

const MIN_CUTOFF = 200;
const MAX_CUTOFF = 18_000;

export const cutoffHertz = (value: number) =>
  MIN_CUTOFF * (MAX_CUTOFF / MIN_CUTOFF) ** (value / 10);
export const releaseSeconds = (value: number) => 0.01 * 150 ** (value / 10);
/** The level of the volume, from 0 to 1, on a square law. */
export const volumeGain = (value: number) => (value / 10) ** 2;

/** The slice a pitch plays: the first from `SAMPLER_FIRST_NOTE`, round again after sixteen. */
export function sliceOf(pitch: number) {
  const steps = Math.round(pitch) - SAMPLER_FIRST_NOTE;
  return ((steps % SAMPLER_SLICES) + SAMPLER_SLICES) % SAMPLER_SLICES;
}

const hz = (hertz: number) =>
  hertz < 1000 ? `${Math.round(hertz)} Hz` : `${(hertz / 1000).toFixed(1)} kHz`;
const ms = (seconds: number) =>
  seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`;

/**
 * A slice sampler as a device, with no panel and no audio in it: a sample cut
 * into sixteen equal slices, each played by a pad or a key, through a low-pass
 * filter, transposed by a pitch, with a release. Struck, a slice plays to its
 * end; held, with the gate on, it plays while the key is down. The sample is
 * one of the two the sampler comes with, so it travels with a project; a host
 * may load a file of its own into the engine. It is an instrument, played with
 * notes (a pitch in hertz picks the slice, see `sliceOf`, and a velocity).
 */
export const samplerDevice = defineDevice({
  description:
    "A slice sampler: a sample cut into sixteen equal slices, a pad or a key each, through a low-pass filter, transposed, with a release, struck to its end or held with the gate.",
  id: "audioui.sampler",
  kind: "instrument",
  name: "Sampler",
  note: [
    {
      default: 65.41,
      id: "frequency",
      label: "Pitch",
      max: 4200,
      min: 20,
      scale: "log",
      unit: "Hz",
    },
    {
      default: 1,
      id: "velocity",
      label: "Velocity",
      max: 1,
      min: 0,
      step: 0.01,
    },
  ],
  parameters: [
    {
      default: "dusty-keys",
      id: "sample",
      kind: "choice",
      label: "Sample",
      options: [
        { label: "Dusty keys", value: "dusty-keys" },
        { label: "Sub line", value: "sub-line" },
      ],
    },
    {
      default: 0,
      id: "pitch",
      label: "Pitch",
      max: 12,
      min: -12,
      step: 1,
      unit: "st",
    },
    {
      default: 10,
      format: (value: number) => hz(cutoffHertz(value)),
      id: "cutoff",
      label: "Filter",
      max: 10,
      min: 0,
      step: 0.1,
    },
    {
      default: 3,
      format: (value: number) => ms(releaseSeconds(value)),
      id: "release",
      label: "Release",
      max: 10,
      min: 0,
      step: 0.1,
    },
    { default: false, id: "gate", kind: "toggle", label: "Gate" },
    {
      default: 7,
      format: (value: number) => `${Math.round(volumeGain(value) * 100)}%`,
      id: "volume",
      label: "Volume",
      max: 10,
      min: 0,
      step: 0.1,
    },
  ],
});

export type SamplerState = DeviceState<typeof samplerDevice.parameters>;

/** What is played: a pitch in hertz, which picks the slice, and how hard, from 0 to 1. */
export interface SamplerNote {
  frequency: number;
  /** How loud the slice plays, from 0 to 1. @default 1 */
  velocity?: number;
}
