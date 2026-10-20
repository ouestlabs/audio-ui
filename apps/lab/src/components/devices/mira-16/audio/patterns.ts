import { INSTRUMENTS, type Instrument, SPAN } from "./engine";

export const STEPS = 16;

interface Preset {
  /** One character a step: `.` is a rest, `x` a bass note and `X` an accented one. */
  bass: string;
  bpm: number;
  name: string;
  /** The bass pitch of each step, in semitones above the root. */
  pitches: readonly number[];
  /** One line per instrument, a step each: `x` is on. Instruments left out are silent. */
  rows: Partial<Record<Instrument, string>>;
}

export const PRESETS: readonly Preset[] = [
  {
    bass: "X.xX..x.X.xX.x.x",
    bpm: 122,
    name: "House",
    pitches: [0, 0, 0, 12, 0, 0, 7, 0, 0, 0, 10, 12, 0, 0, 5, 0],
    rows: {
      clap: "....x.......x...",
      closedHat: "x.x.x.x.x.x.x.x.",
      kick: "x...x...x...x...",
      openHat: "..x...x...x...x.",
    },
  },
  {
    bass: "X..x.xX..x.xx.X.",
    bpm: 94,
    name: "Boom bap",
    pitches: [0, 0, 0, 7, 0, 5, 3, 0, 0, 10, 0, 7, 5, 0, 3, 0],
    rows: {
      closedHat: "x.x.x.x.x.x.x.x.",
      kick: "x.....x...x.....",
      openHat: "..............x.",
      snare: "....x.......x...",
    },
  },
  {
    bass: "xxxxxxxxxxxxxxxx",
    bpm: 126,
    name: "Electro",
    pitches: [0, 7, 12, 7, 3, 10, 15, 10, 5, 12, 17, 12, 7, 14, 19, 14],
    rows: {
      clap: "....x.......x...",
      closedHat: "..x...x...x...x.",
      cowbell: "...x.......x....",
      kick: "x..x..x...x..x..",
      snare: "....x.......x...",
    },
  },
  {
    bass: "X.x.X.x.X.x.X.xx",
    bpm: 110,
    name: "Afro",
    pitches: [0, 0, 7, 0, 0, 0, 5, 0, 0, 0, 7, 0, 3, 0, 10, 12],
    rows: {
      closedHat: "x.x.x.x.x.x.x.x.",
      cowbell: "x.x.x..x.x.x..x.",
      highTom: "....x.....x.....",
      kick: "x..x..x..x..x...",
      lowTom: "..x....x....x...",
    },
  },
];

/**
 * A preset as the grid takes it: a row of steps per instrument, in the panel's
 * order, then the bass gate and the bass accent.
 */
export function patternOf(index: number) {
  const preset = PRESETS[index] ?? PRESETS[0];
  const rows = INSTRUMENTS.map((instrument) =>
    Array.from(
      { length: STEPS },
      (_, step) => preset?.rows[instrument]?.[step] === "x"
    )
  );
  const line = preset?.bass ?? "";
  const gate = Array.from({ length: STEPS }, (_, step) => {
    const mark = line[step];
    return mark === "x" || mark === "X";
  });
  const accent = Array.from({ length: STEPS }, (_, step) => line[step] === "X");
  return [...rows, gate, accent];
}

/** The bass pitches of a preset, kept inside the knobs' range. */
export const pitchesOf = (index: number) =>
  Array.from({ length: STEPS }, (_, step) =>
    Math.min(SPAN, Math.max(0, PRESETS[index]?.pitches[step] ?? 0))
  );
