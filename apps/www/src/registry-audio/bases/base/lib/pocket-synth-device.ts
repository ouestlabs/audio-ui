import { type DeviceState, defineDevice } from "@audio-ui/core/device";

const MIN_FREQUENCY = 30;
const MAX_FREQUENCY = 1046;
const MIN_CUTOFF = 200;
const MAX_CUTOFF = 8000;

/**
 * A small monophonic synth as a device: a waveform, a filter and a level, with
 * no panel and no audio in it. It is an instrument, so it is played with
 * notes (a pitch and a filter cutoff, see `pocketSynthPitch`) and these
 * parameters shape the timbre. Its `note` descriptors give an agent the
 * `audioui_pocket_synth_play` tool. A panel draws its state, an engine plays it, an
 * agent drives it through `deviceTools(pocketSynthDevice)`.
 */
export const pocketSynthDevice = defineDevice({
  description:
    "A monophonic synth: one oscillator of a chosen waveform through a resonant filter, played by pitch and filter cutoff, at a level.",
  id: "audioui.pocket-synth",
  kind: "instrument",
  name: "Pocket Synth",
  note: [
    {
      default: 220,
      id: "frequency",
      label: "Pitch",
      max: MAX_FREQUENCY,
      min: MIN_FREQUENCY,
      scale: "log",
      unit: "Hz",
    },
    {
      default: 1000,
      id: "cutoff",
      label: "Filter cutoff",
      max: MAX_CUTOFF,
      min: MIN_CUTOFF,
      scale: "log",
      unit: "Hz",
    },
  ],
  parameters: [
    {
      default: "square",
      id: "wave",
      kind: "choice",
      label: "Wave",
      options: [
        { label: "Sine", value: "sine" },
        { label: "Triangle", value: "triangle" },
        { label: "Saw", value: "sawtooth" },
        { label: "Square", value: "square" },
      ],
    },
    {
      default: "allpass",
      id: "filter",
      kind: "choice",
      label: "Filter",
      options: [
        { label: "All pass", value: "allpass" },
        { label: "Low pass", value: "lowpass" },
        { label: "High pass", value: "highpass" },
        { label: "Band pass", value: "bandpass" },
      ],
    },
    {
      default: 0.5,
      format: (volume: number) => `${Math.round(volume * 100)}%`,
      id: "volume",
      label: "Volume",
      max: 1,
      min: 0,
      step: 0.01,
    },
  ],
});

export type PocketSynthState = DeviceState<typeof pocketSynthDevice.parameters>;

/** What is played: a pitch and the cutoff of the filter, both in hertz. */
export interface PocketSynthNote {
  cutoff: number;
  frequency: number;
}

/** The pitch at a position from 0 to 1 along a log axis from 30 Hz to 1046 Hz. */
export const pocketSynthPitch = (position: number) =>
  MIN_FREQUENCY * (MAX_FREQUENCY / MIN_FREQUENCY) ** position;

/** The filter cutoff at a position from 0 to 1 along a log axis from 200 Hz to 8 kHz. */
export const pocketSynthCutoff = (position: number) =>
  MIN_CUTOFF * (MAX_CUTOFF / MIN_CUTOFF) ** position;
