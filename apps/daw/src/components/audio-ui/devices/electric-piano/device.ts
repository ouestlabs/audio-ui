import { type DeviceState, defineDevice } from "@audio-ui/engine/device";

/*
 * The controls read 0 to 10, as a panel's knobs do; each one is mapped to the
 * unit the sound takes by the curves below, which the engine plays and the
 * panel shows.
 */
const unit = (value: number) => value / 10;

export const rateHertz = (value: number) => 1.5 * 6 ** unit(value);
export const driveGain = (value: number) => 1 + unit(value) * 5;
/** How long a note rings, in seconds, at middle C: the low keys ring longer, the high ones shorter. */
export const ringSeconds = (value: number, pitch: number) =>
  (0.8 + unit(value) * 5) * 2 ** ((60 - pitch) / 24);

const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;

/** The volume's level, never above -3 dB: silence at 0. */
export function volumeGain(value: number) {
  if (value <= 0) {
    return 0;
  }
  return (
    10 ** ((MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)) / 20)
  );
}

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
 * A tine electric piano as a device, with no panel and no audio in it. A key
 * strikes a tine and a pickup hears it ring: two frequency modulations on a
 * sine, a body on the same pitch that barks when struck hard, and a bell
 * fourteen times up that pings and is gone, through a pickup that can be
 * driven and a tremolo. A note rings down by itself, longer in the bass. It is
 * an instrument, played with notes (a pitch in hertz and a velocity); an
 * engine plays one voice, a host gives it as many as it holds notes.
 */
export const electricPianoDevice = defineDevice({
  description:
    "A tine electric piano: a body that barks when struck hard and a bell that pings, rung down by itself, through a pickup that can be driven and a tremolo. Warm, bell, bark and mellow.",
  id: "audioui.electric-piano",
  kind: "instrument",
  name: "Electric Piano",
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
    control("bark", "Bark", 4),
    control("bell", "Bell", 5),
    control(
      "decay",
      "Decay",
      5,
      (value) => `${ringSeconds(value, 60).toFixed(1)} s`
    ),
    control("drive", "Drive", 3, (value) => `×${driveGain(value).toFixed(1)}`),
    control(
      "rate",
      "Tremolo rate",
      4,
      (value) => `${rateHertz(value).toFixed(1)} Hz`
    ),
    control(
      "depth",
      "Tremolo depth",
      3,
      (value) => `${Math.round(unit(value) * 90)}%`
    ),
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type ElectricPianoState = DeviceState<
  typeof electricPianoDevice.parameters
>;

/** What is played: a pitch in hertz, and how hard, from 0 to 1. */
export interface ElectricPianoNote {
  frequency: number;
  /** How hard the key is struck, from 0 to 1: louder, and brighter in its bark and its bell. @default 1 */
  velocity?: number;
}

/** Four sounds to start from: each names only what it changes from the defaults. */
export const ELECTRIC_PIANO_PRESETS: readonly {
  name: string;
  state: Partial<ElectricPianoState>;
}[] = [
  { name: "Warm", state: {} },
  { name: "Bell", state: { bark: 2, bell: 9, decay: 7, depth: 1, drive: 1 } },
  { name: "Bark", state: { bark: 9, bell: 3, decay: 4, depth: 2, drive: 6 } },
  {
    name: "Mellow",
    state: { bark: 1, bell: 2, decay: 8, depth: 6, drive: 0, rate: 3 },
  },
];

/** A preset's whole state: the defaults, with what it changes on top. */
export function electricPianoPreset(name: string): ElectricPianoState {
  const preset = ELECTRIC_PIANO_PRESETS.find((item) => item.name === name);
  return { ...electricPianoDevice.defaults(), ...preset?.state };
}
