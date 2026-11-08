import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/*
 * The controls read 0 to 10, as a panel's sliders do; each one is mapped to
 * the unit the sound takes by the curves below, which the engine plays and the
 * panel shows.
 */
const unit = (value: number) => value / 10;

export const cutoffHertz = (value: number) => 40 * 300 ** unit(value);
export const resonanceDecibels = (value: number) => unit(value) * 14;
export const contourCents = (value: number) => unit(value) * 4800;
export const rateHertz = (value: number) => 0.2 * 100 ** unit(value);
export const vibratoCents = (value: number) => unit(value) ** 2 * 80;
export const attackSeconds = (value: number) => 0.003 * 600 ** unit(value);
export const decaySeconds = (value: number) => 0.01 * 300 ** unit(value);
export const releaseSeconds = (value: number) => 0.01 * 500 ** unit(value);
/** The pulse's width: a square at the bottom of the control, thin at the top. */
export const pulseWidth = (value: number) => 0.5 - unit(value) * 0.45;

const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;

/** The volume's level, in decibels, never above -3 dB: silence at 0. */
export function volumeGain(value: number) {
  if (value <= 0) {
    return 0;
  }
  return (
    10 ** ((MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)) / 20)
  );
}

const ms = (seconds: number) =>
  seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`;
const hz = (hertz: number) =>
  hertz < 1000 ? `${Math.round(hertz)} Hz` : `${(hertz / 1000).toFixed(1)} kHz`;
const tenth = (value: number) => value.toFixed(1);

/** A control from 0 to 10, as the panel's are. */
const control = <const Id extends string>(
  id: Id,
  label: string,
  defaultValue: number,
  format: (value: number) => string = tenth
) => ({
  default: defaultValue,
  format,
  id,
  label,
  max: 10,
  min: 0,
  step: 0.1,
});

/**
 * An eighties polyphonic synth as a device, with no panel and no audio in it:
 * a saw, a pulse of any width, a sub oscillator an octave down and noise,
 * mixed into a resonant low-pass filter that follows the keyboard, an envelope
 * that opens the filter and the amplifier together, a vibrato and a stereo
 * chorus. It is an instrument, played with notes (a pitch in hertz and a
 * velocity); an engine plays one voice, a host gives it as many as it holds
 * notes. `POLY_SYNTH_PRESETS` are eight sounds to start from.
 */
export const polySynthDevice = defineDevice({
  description:
    "An eighties polyphonic synth: a saw, a pulse, a sub oscillator and noise into a resonant low-pass filter that an envelope opens, with a vibrato and a stereo chorus. Brass, strings, pads, plucks and basses.",
  id: "audioui.poly-synth",
  kind: "instrument",
  name: "Poly Synth",
  note: [
    {
      default: 440,
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
    control("saw", "Saw", 7),
    control("pulse", "Pulse", 4),
    control(
      "width",
      "Pulse width",
      3,
      (value) => `${Math.round(pulseWidth(value) * 100)}%`
    ),
    control("sub", "Sub", 3),
    control("noise", "Noise", 0),
    control("cutoff", "Cutoff", 6, (value) => hz(cutoffHertz(value))),
    control(
      "resonance",
      "Resonance",
      2,
      (value) => `${resonanceDecibels(value).toFixed(1)} dB`
    ),
    control(
      "contour",
      "Envelope amount",
      4,
      (value) => `${Math.round(contourCents(value) / 100)} st`
    ),
    control(
      "keys",
      "Key follow",
      5,
      (value) => `${Math.round(unit(value) * 100)}%`
    ),
    control("attack", "Attack", 1, (value) => ms(attackSeconds(value))),
    control("decay", "Decay", 5, (value) => ms(decaySeconds(value))),
    control(
      "sustain",
      "Sustain",
      7,
      (value) => `${Math.round(unit(value) * 100)}%`
    ),
    control("release", "Release", 3, (value) => ms(releaseSeconds(value))),
    control(
      "rate",
      "Vibrato rate",
      4,
      (value) => `${rateHertz(value).toFixed(1)} Hz`
    ),
    control(
      "vibrato",
      "Vibrato depth",
      0,
      (value) => `${Math.round(vibratoCents(value))} ct`
    ),
    {
      default: "I",
      id: "chorus",
      kind: "choice",
      label: "Chorus",
      options: [
        { label: "Off", value: "Off" },
        { label: "I", value: "I" },
        { label: "II", value: "II" },
      ],
    },
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type PolySynthState = DeviceState<typeof polySynthDevice.parameters>;

/** What is played: a pitch in hertz, and how hard, from 0 to 1. */
export interface PolySynthNote {
  frequency: number;
  /** How loud the note plays, from 0 to 1. @default 1 */
  velocity?: number;
}

/** Eight sounds to start from: each names only what it changes from the defaults. */
export const POLY_SYNTH_PRESETS: readonly {
  name: string;
  state: Partial<PolySynthState>;
}[] = [
  {
    name: "Brass",
    state: {
      attack: 2,
      chorus: "I",
      contour: 6,
      cutoff: 4,
      decay: 5,
      pulse: 0,
      release: 2,
      saw: 9,
      sub: 2,
      sustain: 6,
    },
  },
  {
    name: "Strings",
    state: {
      attack: 6,
      chorus: "II",
      contour: 1,
      cutoff: 6,
      decay: 6,
      pulse: 6,
      rate: 3,
      release: 6,
      saw: 8,
      sub: 0,
      sustain: 8,
      vibrato: 2,
      width: 5,
    },
  },
  {
    name: "Soft Pad",
    state: {
      attack: 7,
      chorus: "II",
      contour: 3,
      cutoff: 4,
      decay: 7,
      pulse: 7,
      release: 8,
      saw: 3,
      sub: 4,
      sustain: 9,
      width: 2,
    },
  },
  {
    name: "Pluck",
    state: {
      attack: 0,
      chorus: "I",
      contour: 8,
      cutoff: 4,
      decay: 3,
      pulse: 6,
      release: 2,
      resonance: 3,
      saw: 8,
      sub: 2,
      sustain: 0,
    },
  },
  {
    name: "Fat Bass",
    state: {
      attack: 0,
      chorus: "Off",
      contour: 6,
      cutoff: 3,
      decay: 4,
      pulse: 6,
      release: 2,
      resonance: 4,
      saw: 8,
      sub: 8,
      sustain: 6,
    },
  },
  {
    name: "Organ",
    state: {
      attack: 0,
      chorus: "II",
      contour: 0,
      cutoff: 10,
      decay: 0,
      pulse: 8,
      rate: 6,
      release: 1,
      saw: 0,
      sub: 7,
      sustain: 10,
      vibrato: 3,
    },
  },
  {
    name: "Sweep",
    state: {
      attack: 4,
      chorus: "I",
      contour: 9,
      cutoff: 2,
      decay: 8,
      pulse: 7,
      release: 6,
      resonance: 6,
      saw: 7,
      sub: 3,
      sustain: 5,
    },
  },
  {
    name: "Glass Lead",
    state: {
      attack: 0,
      chorus: "I",
      contour: 2,
      cutoff: 7,
      decay: 3,
      pulse: 8,
      rate: 5,
      release: 3,
      resonance: 2,
      saw: 5,
      sub: 0,
      sustain: 8,
      vibrato: 4,
      width: 6,
    },
  },
];

/** A preset's whole state: the defaults, with what it changes on top. */
export function polySynthPreset(name: string): PolySynthState {
  const preset = POLY_SYNTH_PRESETS.find((item) => item.name === name);
  return { ...polySynthDevice.defaults(), ...preset?.state };
}
