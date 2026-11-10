import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/*
 * The controls read 0 to 10, as a panel's sliders do; each one is mapped to
 * the unit the sound takes by the curves below, which the engine plays and the
 * panel shows.
 */
const unit = (value: number) => value / 10;

export const cutoffHertz = (value: number) => 40 * 300 ** unit(value);
export const resonanceDecibels = (value: number) => unit(value) * 12;
export const contourCents = (value: number) => unit(value) * 4800;
export const rateHertz = (value: number) => 0.2 * 100 ** unit(value);
export const depthCents = (value: number) => unit(value) ** 2 * 100;
export const glideSeconds = (value: number) => unit(value) * 0.6;
export const attackSeconds = (value: number) => 0.003 * 600 ** unit(value);
export const decaySeconds = (value: number) => 0.01 * 300 ** unit(value);
export const releaseSeconds = (value: number) => 0.01 * 500 ** unit(value);
/** The fine tune, in cents: none at the middle of the control, half a semitone either way at its ends. */
export const tuneCents = (value: number) => (value - 5) * 10;
/** The square's width: even at the bottom of the control, a thin pulse at the top. */
export const pulseWidth = (value: number) => 0.5 - unit(value) * 0.45;

/** How far each range moves the keyboard, in octaves: 8' plays the pitch as it is. */
export const RANGE_OCTAVES = {
  "4'": 1,
  "8'": 0,
  "16'": -1,
  "32'": -2,
} as const;

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
 * A monophonic analog synth as a device, with no panel and no audio in it: an
 * oscillator (a saw, a square of any width or a triangle), a square sub
 * oscillator an octave down and noise, mixed into a resonant low-pass filter
 * that an envelope opens, with a glide between notes and a vibrato. It is an
 * instrument, played with notes (a pitch in hertz and a velocity), one at a
 * time: an engine is the whole synth, and a host gives it every note.
 * `MONO_SYNTH_PRESETS` are eight sounds to start from.
 */
export const monoSynthDevice = defineDevice({
  description:
    "A monophonic analog synth: a saw, square or triangle oscillator, a sub oscillator and noise into a resonant low-pass filter that an envelope opens, with a glide and a vibrato. Basses, leads and acid lines, one note at a time.",
  id: "audioui.mono-synth",
  kind: "instrument",
  name: "Mono Synth",
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
    {
      default: "sawtooth",
      id: "wave",
      kind: "choice",
      label: "Wave",
      options: [
        { label: "Saw", value: "sawtooth" },
        { label: "Square", value: "square" },
        { label: "Triangle", value: "triangle" },
      ],
    },
    {
      default: "8'",
      id: "range",
      kind: "choice",
      label: "Range",
      options: [
        { label: "32'", value: "32'" },
        { label: "16'", value: "16'" },
        { label: "8'", value: "8'" },
        { label: "4'", value: "4'" },
      ],
    },
    control("tune", "Tune", 5, (value) => {
      const cents = Math.round(tuneCents(value));
      return `${cents > 0 ? "+" : ""}${cents} ct`;
    }),
    control("osc", "Oscillator", 8),
    control(
      "width",
      "Pulse width",
      0,
      (value) => `${Math.round(pulseWidth(value) * 100)}%`
    ),
    control("sub", "Sub", 4),
    control("noise", "Noise", 1),
    control("cutoff", "Cutoff", 6, (value) => hz(cutoffHertz(value))),
    control(
      "resonance",
      "Resonance",
      3,
      (value) => `${resonanceDecibels(value).toFixed(1)} dB`
    ),
    control(
      "contour",
      "Envelope amount",
      5,
      (value) => `${Math.round(contourCents(value) / 100)} st`
    ),
    control("attack", "Attack", 1, (value) => ms(attackSeconds(value))),
    control("decay", "Decay", 4, (value) => ms(decaySeconds(value))),
    control(
      "sustain",
      "Sustain",
      7,
      (value) => `${Math.round(unit(value) * 100)}%`
    ),
    control("release", "Release", 3, (value) => ms(releaseSeconds(value))),
    control("glide", "Glide", 2, (value) => ms(glideSeconds(value))),
    control(
      "rate",
      "Vibrato rate",
      3,
      (value) => `${rateHertz(value).toFixed(1)} Hz`
    ),
    control(
      "depth",
      "Vibrato depth",
      0,
      (value) => `${Math.round(depthCents(value))} ct`
    ),
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type MonoSynthState = DeviceState<typeof monoSynthDevice.parameters>;

/** What is played: a pitch in hertz, and how hard, from 0 to 1. */
export interface MonoSynthNote {
  frequency: number;
  /** How loud the note plays, from 0 to 1. @default 1 */
  velocity?: number;
}

/** Eight sounds to start from: each names only what it changes from the defaults. */
export const MONO_SYNTH_PRESETS: readonly {
  name: string;
  state: Partial<MonoSynthState>;
}[] = [
  { name: "Init Saw", state: {} },
  {
    name: "Warm Pad",
    state: {
      attack: 6,
      contour: 3,
      cutoff: 4,
      decay: 6,
      release: 6,
      resonance: 1,
      sub: 5,
      sustain: 8,
      wave: "triangle",
    },
  },
  {
    name: "Acid Bass",
    state: {
      attack: 0,
      contour: 8,
      cutoff: 3,
      decay: 3,
      glide: 3,
      release: 2,
      resonance: 8,
      sub: 0,
      sustain: 2,
    },
  },
  {
    name: "Pluck",
    state: {
      attack: 0,
      contour: 6,
      cutoff: 5,
      decay: 3,
      release: 3,
      sustain: 0,
      wave: "square",
    },
  },
  {
    name: "Brass",
    state: {
      attack: 2,
      cutoff: 5,
      release: 3,
      resonance: 2,
      sustain: 6,
    },
  },
  {
    name: "Sub Bass",
    state: {
      attack: 0,
      contour: 2,
      cutoff: 3,
      osc: 5,
      release: 2,
      resonance: 1,
      sub: 10,
      sustain: 8,
      wave: "square",
    },
  },
  {
    name: "Lead",
    state: {
      contour: 4,
      cutoff: 7,
      depth: 2,
      glide: 4,
      rate: 5,
      resonance: 4,
      wave: "square",
      width: 5,
    },
  },
  {
    name: "Wind",
    state: {
      attack: 6,
      cutoff: 5,
      decay: 6,
      noise: 8,
      osc: 2,
      release: 7,
      resonance: 5,
      sub: 0,
      sustain: 6,
      wave: "triangle",
    },
  },
];

/** A preset's whole state: the defaults, with what it changes on top. */
export function monoSynthPreset(name: string): MonoSynthState {
  const preset = MONO_SYNTH_PRESETS.find((item) => item.name === name);
  return { ...monoSynthDevice.defaults(), ...preset?.state };
}
