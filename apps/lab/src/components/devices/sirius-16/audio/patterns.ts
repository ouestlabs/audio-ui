import { SPAN } from "./engine";

export const STEPS = 16;

interface Preset {
  bpm: number;
  /** One character a step: `.` is a rest, `x` a note that plays and `X` a note that is accented. */
  line: string;
  name: string;
  /** The pitch of each step, in semitones above the root: a list of up to sixteen, one a step. */
  pitches: readonly number[];
}

/** Four lines for the sequencer to start from. */
export const PRESETS: readonly Preset[] = [
  {
    bpm: 124,
    line: "xx.xX.x.xx.xXx.x",
    name: "Acid line",
    pitches: [0, 0, 0, 12, 7, 0, 10, 0, 0, 0, 0, 12, 3, 0, 5, 0],
  },
  {
    bpm: 96,
    line: "X..x.xX..x.xx.X.",
    name: "Rolling bass",
    pitches: [0, 0, 0, 7, 0, 5, 3, 0, 0, 10, 0, 7, 5, 0, 3, 0],
  },
  {
    bpm: 112,
    line: "xxxxxxxxxxxxxxxx",
    name: "Arpeggio",
    pitches: [0, 7, 12, 7, 3, 10, 15, 10, 5, 12, 17, 12, 7, 14, 19, 14],
  },
  {
    bpm: 132,
    line: "x.x.x.x.x.x.x.x.",
    name: "Pulse",
    pitches: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 7, 0, 10, 0],
  },
];

/** The slides of each line: the steps that glide from the note before. */
const SLIDES: readonly (readonly number[])[] = [
  [4, 12],
  [6, 11],
  [3, 7, 11],
  [],
];

/** What the sequencer's grid reads: a gate row, an accent row and a slide row of sixteen steps. */
export function patternOf(index: number) {
  const preset = PRESETS[index] ?? PRESETS[0];
  const line = preset?.line ?? "";
  const gate = Array.from(
    { length: STEPS },
    (_, step) => line[step] !== "." && line[step] !== undefined
  );
  const accent = Array.from({ length: STEPS }, (_, step) => line[step] === "X");
  const slide = Array.from(
    { length: STEPS },
    (_, step) => SLIDES[index]?.includes(step) ?? false
  );
  return [gate, accent, slide];
}

/** The pitches of a line, kept inside the knobs' range. */
export const pitchesOf = (index: number) =>
  Array.from({ length: STEPS }, (_, step) =>
    Math.min(SPAN, Math.max(0, PRESETS[index]?.pitches[step] ?? 0))
  );
