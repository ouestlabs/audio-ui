/**
 * Scales on a root: which pitch classes a scale keeps. The steps of most come
 * from `@audio/note`, with the three church modes it does not list added; the
 * snapping is its `snapMidi`.
 */

import { SCALES as NOTE_SCALES, snapMidi } from "@audio/note";
import type { RollScale } from "@audio-ui/core/piano-roll";

/** The steps of each scale, as semitones above the root. */
export const SCALES = {
  ...NOTE_SCALES,
  locrian: [0, 1, 3, 5, 6, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const satisfies Record<string, readonly number[]>;

/** The name of a scale of `SCALES`. */
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
  return snapMidi(Math.round(pitch), {
    root: scale.root,
    scale: SCALES[scale.name],
  });
}

/** A scale as a piano roll reads it: its pitch classes and its root, what `@audio-ui/core/piano-roll` takes. */
export function rollScale(scale: Scale): RollScale {
  return { pitchClasses: scalePitchClasses(scale), root: scale.root };
}
