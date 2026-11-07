import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/*
 * The controls read 0 to 10, as a panel's sliders do, the ratios in steps of
 * a list and the algorithm by its number; each one is mapped to the unit the
 * sound takes by the curves below, which the engine plays and the panel shows.
 */
const unit = (value: number) => value / 10;

export type FmOperator = 1 | 2 | 3 | 4;
export const FM_OPERATORS: readonly FmOperator[] = [1, 2, 3, 4];

export interface FmAlgorithm {
  at: Record<FmOperator, readonly [column: number, row: number]>;
  carriers: readonly FmOperator[];
  /** Who modulates whom: `[from, to]`. */
  links: readonly (readonly [FmOperator, FmOperator])[];
}

/** The eight ways the four operators are wired, as a four-operator FM synth prints them on its panel. */
export const FM_ALGORITHMS: readonly FmAlgorithm[] = [
  {
    at: { 1: [0, 0], 2: [0, 1], 3: [0, 2], 4: [0, 3] },
    carriers: [1],
    links: [
      [4, 3],
      [3, 2],
      [2, 1],
    ],
  },
  {
    at: { 1: [0.5, 0], 2: [0.5, 1], 3: [0, 2], 4: [1, 2] },
    carriers: [1],
    links: [
      [3, 2],
      [4, 2],
      [2, 1],
    ],
  },
  {
    at: { 1: [0.5, 0], 2: [0, 1], 3: [0, 2], 4: [1, 1] },
    carriers: [1],
    links: [
      [3, 2],
      [2, 1],
      [4, 1],
    ],
  },
  {
    at: { 1: [0.5, 0], 2: [0, 1], 3: [1, 1], 4: [1, 2] },
    carriers: [1],
    links: [
      [4, 3],
      [3, 1],
      [2, 1],
    ],
  },
  {
    at: { 1: [0, 0], 2: [0, 1], 3: [1, 0], 4: [1, 1] },
    carriers: [1, 3],
    links: [
      [2, 1],
      [4, 3],
    ],
  },
  {
    at: { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [1, 1] },
    carriers: [1, 2, 3],
    links: [
      [4, 1],
      [4, 2],
      [4, 3],
    ],
  },
  {
    at: { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [2, 1] },
    carriers: [1, 2, 3],
    links: [[4, 3]],
  },
  {
    at: { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [3, 0] },
    carriers: [1, 2, 3, 4],
    links: [],
  },
];

/** The algorithm at its number, from 1 to 8: the first when it is out of range. */
export const fmAlgorithm = (number: number) =>
  FM_ALGORITHMS[Math.round(number) - 1] ?? (FM_ALGORITHMS[0] as FmAlgorithm);

/** The frequency ratios an operator can take, from an octave down to fourteen times up; the uneven ones ring like metal. */
export const FM_RATIOS = [
  0.5, 1, 1.41, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 9, 11, 14,
] as const;

export const ratioOf = (index: number) =>
  FM_RATIOS[Math.round(index)] ?? FM_RATIOS[1];
export const attackSeconds = (value: number) => 0.002 * 500 ** unit(value);
export const decaySeconds = (value: number) => 0.03 * 300 ** unit(value);
export const releaseSeconds = (value: number) => 0.02 * 300 ** unit(value);
export const vibratoCents = (value: number) => unit(value) ** 2 * 40;

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

const ms = (seconds: number) =>
  seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`;
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

/** An operator's four controls: its ratio, its level, its decay and the level it sustains at. */
const operator = <const N extends FmOperator>(
  n: N,
  defaults: { decay: number; level: number; ratio: number; sustain: number }
) =>
  [
    {
      default: defaults.ratio,
      format: (index: number) => `×${ratioOf(index)}`,
      id: `ratio${n}` as const,
      label: `Operator ${n} ratio`,
      max: FM_RATIOS.length - 1,
      min: 0,
      step: 1,
    },
    control(`level${n}` as const, `Operator ${n} level`, defaults.level),
    control(
      `decay${n}` as const,
      `Operator ${n} decay`,
      defaults.decay,
      (value) => ms(decaySeconds(value))
    ),
    control(
      `sustain${n}` as const,
      `Operator ${n} sustain`,
      defaults.sustain,
      (value) => `${Math.round(unit(value) * 100)}%`
    ),
  ] as const;

/**
 * A four-operator FM synth as a device, with no panel and no audio in it. Each
 * operator is a sine at a ratio of the pitch, with its own level and its own
 * envelope; the algorithm wires them, a carrier heard and a modulator bending
 * the pitch of the operator under it, which grows the harmonics: the deeper,
 * the brighter, so a sound can start bright and mellow as it rings. Operator 4
 * can feed back on itself, from a sine towards a saw. It is an instrument,
 * played with notes (a pitch in hertz and a velocity, which also brightens);
 * an engine plays one voice, a host gives it as many as it holds notes.
 */
export const fmSynthDevice = defineDevice({
  description:
    "A four-operator FM synth: four sines at ratios of the pitch, each with its level and its envelope, wired by eight algorithms, with feedback and a vibrato. Electric pianos, bells, basses, brass, marimbas and clavs.",
  id: "audioui.fm-synth",
  kind: "instrument",
  name: "FM Synth",
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
      default: 5,
      format: (number: number) =>
        `${Math.round(number)}: ${fmAlgorithm(number).carriers.length} heard`,
      id: "algorithm",
      label: "Algorithm",
      max: FM_ALGORITHMS.length,
      min: 1,
      step: 1,
    },
    control("feedback", "Feedback", 0),
    control("attack", "Attack", 0, (value) => ms(attackSeconds(value))),
    control("release", "Release", 3, (value) => ms(releaseSeconds(value))),
    control(
      "vibrato",
      "Vibrato",
      1,
      (value) => `${Math.round(vibratoCents(value))} ct`
    ),
    ...operator(1, { decay: 7, level: 8, ratio: 1, sustain: 0 }),
    ...operator(2, { decay: 5, level: 5, ratio: 1, sustain: 2 }),
    ...operator(3, { decay: 5, level: 6, ratio: 1, sustain: 0 }),
    ...operator(4, { decay: 3, level: 4, ratio: 13, sustain: 0 }),
    control("volume", "Volume", 7, (value) =>
      value <= 0
        ? "-∞ dB"
        : `${(MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB)).toFixed(1)} dB`
    ),
  ],
});

export type FmSynthState = DeviceState<typeof fmSynthDevice.parameters>;

/** What is played: a pitch in hertz, and how hard, from 0 to 1. */
export interface FmSynthNote {
  frequency: number;
  /** How hard the key is played, from 0 to 1: louder, and brighter. @default 1 */
  velocity?: number;
}

/** Eight sounds to start from: each names only what it changes from the defaults. */
export const FM_SYNTH_PRESETS: readonly {
  name: string;
  state: Partial<FmSynthState>;
}[] = [
  // Two pairs: a mellow body, and a tine that rings at fourteen times the pitch and dies fast.
  { name: "E.Piano", state: {} },
  {
    name: "Tubular",
    state: {
      algorithm: 5,
      decay1: 9,
      decay2: 8,
      decay3: 8,
      decay4: 6,
      level1: 8,
      level2: 6,
      level3: 5,
      level4: 5,
      ratio1: 1,
      ratio2: 6,
      ratio3: 4,
      ratio4: 2,
      release: 7,
      sustain2: 0,
      vibrato: 0,
    },
  },
  {
    name: "Bass",
    state: {
      algorithm: 4,
      decay1: 6,
      decay2: 4,
      decay3: 3,
      decay4: 3,
      feedback: 6,
      level1: 9,
      level2: 6,
      level3: 4,
      level4: 4,
      ratio1: 1,
      ratio2: 1,
      ratio3: 1,
      ratio4: 1,
      release: 1,
      sustain1: 5,
      sustain2: 2,
      sustain3: 1,
      sustain4: 0,
      vibrato: 0,
    },
  },
  {
    name: "Brass",
    state: {
      algorithm: 2,
      attack: 3,
      decay1: 6,
      decay2: 6,
      decay3: 5,
      decay4: 5,
      feedback: 5,
      level1: 8,
      level2: 6,
      level3: 3,
      level4: 3,
      ratio1: 1,
      ratio2: 1,
      ratio3: 1,
      ratio4: 3,
      release: 3,
      sustain1: 8,
      sustain2: 6,
      sustain3: 5,
      sustain4: 4,
      vibrato: 2,
    },
  },
  {
    name: "Marimba",
    state: {
      algorithm: 5,
      decay1: 4,
      decay2: 2,
      decay3: 3,
      decay4: 1,
      level1: 9,
      level2: 4,
      level3: 4,
      level4: 4,
      ratio1: 1,
      ratio2: 7,
      ratio3: 7,
      ratio4: 9,
      release: 2,
      sustain1: 0,
      sustain2: 0,
      sustain3: 0,
      sustain4: 0,
      vibrato: 0,
    },
  },
  {
    name: "Clav",
    state: {
      algorithm: 1,
      decay1: 5,
      decay2: 4,
      decay3: 3,
      decay4: 2,
      feedback: 7,
      level1: 9,
      level2: 6,
      level3: 4,
      level4: 3,
      ratio1: 1,
      ratio2: 5,
      ratio3: 1,
      ratio4: 3,
      release: 1,
      sustain1: 2,
      sustain2: 2,
      sustain3: 1,
      sustain4: 0,
      vibrato: 0,
    },
  },
  {
    name: "Organ",
    state: {
      algorithm: 8,
      decay1: 5,
      decay2: 5,
      decay3: 5,
      decay4: 5,
      feedback: 2,
      level1: 8,
      level2: 8,
      level3: 6,
      level4: 5,
      ratio1: 0,
      ratio2: 1,
      ratio3: 3,
      ratio4: 5,
      release: 1,
      sustain1: 10,
      sustain2: 10,
      sustain3: 10,
      sustain4: 10,
      vibrato: 3,
    },
  },
  {
    name: "Glass Pad",
    state: {
      algorithm: 6,
      attack: 6,
      decay1: 8,
      decay2: 8,
      decay3: 8,
      decay4: 7,
      level1: 7,
      level2: 6,
      level3: 5,
      level4: 4,
      ratio1: 1,
      ratio2: 3,
      ratio3: 5,
      ratio4: 10,
      release: 7,
      sustain1: 8,
      sustain2: 8,
      sustain3: 7,
      sustain4: 3,
      vibrato: 3,
    },
  },
];

/** A preset's whole state: the defaults, with what it changes on top. */
export function fmSynthPreset(name: string): FmSynthState {
  const preset = FM_SYNTH_PRESETS.find((item) => item.name === name);
  return { ...fmSynthDevice.defaults(), ...preset?.state };
}