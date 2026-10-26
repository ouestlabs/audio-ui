/**
 * The rhythm box's four patterns: the drums, and the auto bass and chord that
 * play the chord held on the buttons, on a grid of sixteenths. A waltz has
 * three beats a bar, the others four.
 */

export type Rhythm = "Bossa" | "Disco" | "Rock" | "Waltz";
export const RHYTHMS: readonly Rhythm[] = ["Rock", "Waltz", "Bossa", "Disco"];

export interface Pattern {
  /** The bass on its steps: the chord's root, or its fifth. */
  bass: readonly { degree: "fifth" | "root"; step: number }[];
  bpm: number;
  /** Short stabs of the chord. */
  chord: readonly number[];
  hat: readonly number[];
  kick: readonly number[];
  snare: readonly number[];
  steps: number;
}

const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];

export const PATTERNS: Record<Rhythm, Pattern> = {
  Bossa: {
    bass: [
      { degree: "root", step: 0 },
      { degree: "fifth", step: 6 },
      { degree: "root", step: 8 },
      { degree: "fifth", step: 14 },
    ],
    bpm: 132,
    chord: [3, 6, 10, 13],
    hat: EIGHTHS,
    kick: [0, 6, 8, 14],
    snare: [3, 6, 10, 13],
    steps: 16,
  },
  Disco: {
    bass: [
      { degree: "root", step: 0 },
      { degree: "root", step: 4 },
      { degree: "fifth", step: 8 },
      { degree: "root", step: 12 },
    ],
    bpm: 118,
    chord: [2, 6, 10, 14],
    hat: [2, 6, 10, 14],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    steps: 16,
  },
  Rock: {
    bass: [
      { degree: "root", step: 0 },
      { degree: "root", step: 6 },
      { degree: "fifth", step: 8 },
    ],
    bpm: 104,
    chord: [4, 12],
    hat: EIGHTHS,
    kick: [0, 8, 10],
    snare: [4, 12],
    steps: 16,
  },
  Waltz: {
    bass: [{ degree: "root", step: 0 }],
    bpm: 96,
    chord: [4, 8],
    hat: [4, 8],
    kick: [0],
    snare: [],
    steps: 12,
  },
};
