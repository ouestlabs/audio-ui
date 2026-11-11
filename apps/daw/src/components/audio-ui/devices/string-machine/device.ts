import { type DeviceState, defineDevice } from "@audio-ui/engine/device";

/*
 * The controls read 0 to 10, as a panel's sliders do; each one is mapped to
 * the unit the sound takes by the curves below, which the engine plays and the
 * panel shows.
 */
const unit = (value: number) => value / 10;

export const attackSeconds = (value: number) => 0.01 + unit(value) ** 2 * 1.8;
export const releaseSeconds = (value: number) => 0.08 + unit(value) ** 2 * 2.4;
export const cutoffHertz = (value: number) => 700 * 14 ** unit(value);
export const registerGain = (value: number) => unit(value) ** 1.5;
export const ensembleDepth = (value: number) => 0.0004 + unit(value) * 0.0026;

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
 * A string machine as a device, with no panel and no audio in it: four
 * registers (a violin and a viola at the key's pitch, a cello an octave down
 * and a bass two), a brightness filter, a slow bow in and out, and an
 * ensemble that thickens the sound as a section of players does. It is an
 * instrument, played with notes (a pitch in hertz and a velocity); an engine
 * plays one voice, a host gives it as many as it holds notes.
 * `STRING_MACHINE_PRESETS` are eight sounds to start from.
 */
export const stringMachineDevice = defineDevice({
  description:
    "A string machine: a violin, a viola, a cello and a bass register into a brightness filter, bowed in and out slowly, through an ensemble. Strings, violins, cellos, swells, pizzicato and choirs.",
  id: "audioui.string-machine",
  kind: "instrument",
  name: "String Machine",
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
    control("violin", "Violin", 8),
    control("viola", "Viola", 4),
    control("cello", "Cello", 5),
    control("bass", "Bass", 0),
    control("bright", "Brightness", 6, (value) => hz(cutoffHertz(value))),
    control("ensemble", "Ensemble", 6),
    control("attack", "Attack", 4, (value) => ms(attackSeconds(value))),
    control("release", "Release", 5, (value) => ms(releaseSeconds(value))),
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type StringMachineState = DeviceState<
  typeof stringMachineDevice.parameters
>;

/** What is played: a pitch in hertz, and how hard, from 0 to 1. */
export interface StringMachineNote {
  frequency: number;
  /** How hard the note is bowed, from 0 to 1: it leans on the level a little, as strings do. @default 1 */
  velocity?: number;
}

/** Eight sounds to start from: each names only what it changes from the defaults. */
export const STRING_MACHINE_PRESETS: readonly {
  name: string;
  state: Partial<StringMachineState>;
}[] = [
  { name: "Strings", state: {} },
  { name: "Violins", state: { bass: 0, cello: 0, viola: 3, violin: 10 } },
  {
    name: "Cellos",
    state: { bass: 3, bright: 4, cello: 9, viola: 2, violin: 0 },
  },
  {
    name: "Full",
    state: { bass: 5, cello: 7, ensemble: 8, viola: 7, violin: 9 },
  },
  { name: "Swell", state: { attack: 8, bright: 5, ensemble: 7, release: 8 } },
  {
    name: "Pizz",
    state: { attack: 0, bright: 8, cello: 3, ensemble: 3, release: 1 },
  },
  {
    name: "Dark",
    state: { bright: 2, cello: 6, ensemble: 5, viola: 7, violin: 3 },
  },
  {
    name: "Choir",
    state: {
      attack: 7,
      bright: 3,
      cello: 0,
      ensemble: 9,
      release: 7,
      viola: 8,
      violin: 5,
    },
  },
];

/** A preset's whole state: the defaults, with what it changes on top. */
export function stringMachinePreset(name: string): StringMachineState {
  const preset = STRING_MACHINE_PRESETS.find((item) => item.name === name);
  return { ...stringMachineDevice.defaults(), ...preset?.state };
}