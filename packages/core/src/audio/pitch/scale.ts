/**
 * Scales: the pitch classes a scale keeps above its root, inside one octave.
 * A scale is a root (a pitch class, 0 for C) and the name of its steps.
 */

/** The steps of each scale, as semitones above the root. */
export const SCALES = {
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  "major-pentatonic": [0, 2, 4, 7, 9],
  "melodic-minor": [0, 2, 3, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  "minor-pentatonic": [0, 3, 5, 7, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const satisfies Record<string, readonly number[]>;

export type ScaleName = keyof typeof SCALES;

/** A scale on a root: C major is `{ name: "major", root: 0 }`. */
export interface Scale {
  name: ScaleName;
  /** The pitch class it starts on: 0 is C, 11 is B. */
  root: number;
}

const pitchClass = (pitch: number) => ((Math.round(pitch) % 12) + 12) % 12;

/** The pitch classes a scale keeps, from 0 (C) to 11 (B), in order. */
export function scalePitchClasses({ name, root }: Scale): number[] {
  return SCALES[name]
    .map((step) => pitchClass(root + step))
    .sort((a, b) => a - b);
}

/** Whether a MIDI pitch is in a scale. */
export function inScale(pitch: number, scale: Scale): boolean {
  return scalePitchClasses(scale).includes(pitchClass(pitch));
}

/**
 * The pitch in a scale nearest `pitch`: itself when it is in it, else the
 * nearest one, the lower of two as near.
 */
export function nearestInScale(pitch: number, scale: Scale): number {
  const classes = scalePitchClasses(scale);
  const rounded = Math.round(pitch);
  for (let distance = 0; distance <= 6; distance += 1) {
    if (classes.includes(pitchClass(rounded - distance))) {
      return rounded - distance;
    }
    if (classes.includes(pitchClass(rounded + distance))) {
      return rounded + distance;
    }
  }
  return rounded;
}
