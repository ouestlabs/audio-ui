/**
 * The eight ways Nova-4's four operators are wired, as a four-operator FM
 * synth prints them on its panel. An operator is a sine oscillator: a carrier
 * is heard, a modulator is not, it bends the pitch of the operator under it
 * many times a second, and that is what makes the harmonics. Operator 4 can
 * also modulate itself (the feedback), so it is drawn with a loop.
 *
 * `at` places each operator in the drawing of the LCD: a column, and a row
 * counted up from the carriers at the bottom.
 */

export type Operator = 1 | 2 | 3 | 4;
export const OPERATORS: readonly Operator[] = [1, 2, 3, 4];

export interface Algorithm {
  at: Record<Operator, readonly [column: number, row: number]>;
  carriers: readonly Operator[];
  /** Who modulates whom: `[from, to]`. */
  links: readonly (readonly [Operator, Operator])[];
}

export const ALGORITHMS: readonly Algorithm[] = [
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

/** The algorithm at a 1-based number, the first when it is out of range. */
export const algorithmOf = (number: number) =>
  ALGORITHMS[number - 1] ?? (ALGORITHMS[0] as Algorithm);
