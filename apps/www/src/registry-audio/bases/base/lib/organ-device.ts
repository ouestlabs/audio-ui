import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** How far a drawbar pulls: from 0, silent, to 8, full. */
export const MAX_DRAWBAR = 8;

/** The drawbars, from the 16' an octave under the key to the 1' three octaves over it, and each one's pitch against the key. */
export const ORGAN_DRAWBARS = [
  { footage: "16'", id: "drawbar1", ratio: 0.5 },
  { footage: "5⅓'", id: "drawbar2", ratio: 1.5 },
  { footage: "8'", id: "drawbar3", ratio: 1 },
  { footage: "4'", id: "drawbar4", ratio: 2 },
  { footage: "2⅔'", id: "drawbar5", ratio: 3 },
  { footage: "2'", id: "drawbar6", ratio: 4 },
  { footage: "1⅗'", id: "drawbar7", ratio: 5 },
  { footage: "1⅓'", id: "drawbar8", ratio: 6 },
  { footage: "1'", id: "drawbar9", ratio: 8 },
] as const;

export type OrganDrawbar = (typeof ORGAN_DRAWBARS)[number]["id"];

const unit = (value: number) => value / 10;

/** A drawbar's gain: each step is 3 dB, so the eighth is full and the first is 21 dB under it. */
export const drawbarGain = (level: number) =>
  level <= 0 ? 0 : 10 ** (-((MAX_DRAWBAR - level) * 3) / 20);
export const driveGain = (value: number) => 1 + unit(value) * 5;
export const clickGain = (value: number) => unit(value) ** 2 * 0.5;

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

const tenth = (value: number) => value.toFixed(1);

/** A drawbar, pulled from 0 to 8 in whole steps. */
const drawbar = <const Id extends string>(
  id: Id,
  footage: string,
  defaultValue: number
) => ({
  default: defaultValue,
  format: (value: number) => String(Math.round(value)),
  id,
  label: `Drawbar ${footage}`,
  max: MAX_DRAWBAR,
  min: 0,
  step: 1,
});

/** A control from 0 to 10, as the panel's knobs are. */
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
 * A tonewheel organ as a device, with no panel and no audio in it: nine
 * drawbars, each a sine at one of the organ's harmonics, a percussion on the
 * second or third harmonic, a key click, an overdrive and a rotary speaker. It
 * is an instrument, played with notes (a pitch in hertz and a velocity); an
 * engine plays one key, a host gives it as many as it holds notes.
 * `ORGAN_PRESETS` are six registrations to start from.
 */
export const organDevice = defineDevice({
  description:
    "A tonewheel organ: nine drawbars of sines at the organ's harmonics, a percussion, a key click, an overdrive and a rotary speaker. Jazz, gospel, rock, church and flute registrations.",
  id: "audioui.organ",
  kind: "instrument",
  name: "Organ",
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
    drawbar("drawbar1", "16'", 8),
    drawbar("drawbar2", "5⅓'", 8),
    drawbar("drawbar3", "8'", 8),
    drawbar("drawbar4", "4'", 0),
    drawbar("drawbar5", "2⅔'", 0),
    drawbar("drawbar6", "2'", 0),
    drawbar("drawbar7", "1⅗'", 0),
    drawbar("drawbar8", "1⅓'", 0),
    drawbar("drawbar9", "1'", 0),
    { default: false, id: "percussion", kind: "toggle", label: "Percussion" },
    {
      default: "third",
      id: "harmonic",
      kind: "choice",
      label: "Percussion harmonic",
      options: [
        { label: "2nd", value: "second" },
        { label: "3rd", value: "third" },
      ],
    },
    {
      default: "fast",
      id: "decay",
      kind: "choice",
      label: "Percussion decay",
      options: [
        { label: "Fast", value: "fast" },
        { label: "Slow", value: "slow" },
      ],
    },
    control("click", "Key click", 3),
    control("drive", "Drive", 2),
    {
      default: "slow",
      id: "rotary",
      kind: "choice",
      label: "Rotary",
      options: [
        { label: "Stop", value: "stop" },
        { label: "Slow", value: "slow" },
        { label: "Fast", value: "fast" },
      ],
    },
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type OrganState = DeviceState<typeof organDevice.parameters>;

/** What is played: a pitch in hertz, and how hard, from 0 to 1. */
export interface OrganNote {
  frequency: number;
  /** How loud the note plays, from 0 to 1. @default 1 */
  velocity?: number;
}

/** The nine drawbars as a registration is written, a digit each from the 16' to the 1', to the state they set. */
function registration(bars: string): Partial<OrganState> {
  return Object.fromEntries(
    ORGAN_DRAWBARS.map((bar, index) => [bar.id, Number(bars[index] ?? 0)])
  );
}

/** Six registrations to start from: each names its drawbars and only what else it changes. */
export const ORGAN_PRESETS: readonly {
  name: string;
  state: Partial<OrganState>;
}[] = [
  {
    name: "Jazz",
    state: { ...registration("888000000"), percussion: true },
  },
  {
    name: "Gospel",
    state: { ...registration("888800008"), drive: 3, rotary: "fast" },
  },
  {
    name: "Rock",
    state: { ...registration("888800000"), drive: 6, rotary: "fast" },
  },
  {
    name: "Church",
    state: { ...registration("006080400"), drive: 0, rotary: "stop" },
  },
  {
    name: "Flute",
    state: {
      ...registration("008000000"),
      drive: 0,
      harmonic: "second",
      percussion: true,
    },
  },
  {
    name: "Full",
    state: { ...registration("888888888"), rotary: "fast" },
  },
];

/** A preset's whole state: the defaults, with what it changes on top. */
export function organPreset(name: string): OrganState {
  const preset = ORGAN_PRESETS.find((item) => item.name === name);
  return { ...organDevice.defaults(), ...preset?.state };
}
