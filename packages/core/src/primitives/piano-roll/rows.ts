/**
 * A scale as a piano roll reads it: the pitch classes it keeps and the one it
 * starts on, each from 0 (C) to 11 (B). C major is
 * `{ pitchClasses: [0, 2, 4, 5, 7, 9, 11], root: 0 }`; a scale by name, such
 * as `@audio-ui/engine/pitch`'s, gives its pitch classes.
 */
export interface RollScale {
  pitchClasses: readonly number[];
  root: number;
}

/** A pitch's class, 0 (C) to 11 (B). */
export const pitchClassOf = (pitch: number) =>
  ((Math.round(pitch) % 12) + 12) % 12;

/**
 * The rows a piano roll draws, highest pitch first, and the conversions
 * between a pitch and its row. Folding is nothing but a different list of
 * rows: every part reads its geometry from here.
 */
export interface Rows {
  /** Whether only some pitches are drawn: those carrying notes, or with a scale, those in it too. */
  folded: boolean;
  /** The pitch on `row`, carrying on by semitones past either end. */
  pitchAt: (row: number) => number;
  /** Highest first, which is top to bottom on screen. */
  pitches: readonly number[];
  /** The pitch class of the scale's root, 0 (C) to 11 (B), or null without a scale. */
  root: number | null;
  /** The row `pitch` is drawn on; a pitch with no row of its own sits on the row it would be inserted at. */
  rowOf: (pitch: number) => number;
  /** The pitch classes of the roll's scale, 0 (C) to 11 (B), or null without one. */
  scale: readonly number[] | null;
  /** Where a note at `pitch` lands after moving `rows` rows down (negative is up). */
  step: (pitch: number, rows: number) => number;
}

/** Every pitch from `max` down to `min`. */
function chromatic(
  min: number,
  max: number,
  scale: readonly number[] | null,
  root: number | null
): Rows {
  const pitches: number[] = [];
  for (let pitch = max; pitch >= min; pitch -= 1) {
    pitches.push(pitch);
  }
  return {
    folded: false,
    pitchAt: (row) => max - row,
    pitches,
    root,
    rowOf: (pitch) => max - pitch,
    scale,
    step: (pitch, rows) => pitch - rows,
  };
}

/** Only `pitches` (highest first), continuing by semitones past either end. */
function folded(
  pitches: number[],
  scale: readonly number[] | null,
  root: number | null
): Rows {
  const last = pitches.length - 1;
  const pitchAt = (row: number): number => {
    if (row < 0) {
      return (pitches[0] ?? 0) - row;
    }
    if (row > last) {
      return (pitches[last] ?? 0) - (row - last);
    }
    return pitches[row] ?? 0;
  };
  const rowOf = (pitch: number): number => {
    const found = pitches.indexOf(pitch);
    if (found !== -1) {
      return found;
    }
    const below = pitches.findIndex((other) => other < pitch);
    return below === -1 ? pitches.length : below;
  };
  return {
    folded: true,
    pitchAt,
    pitches,
    root,
    rowOf,
    scale,
    step: (pitch, rows) => pitchAt(rowOf(pitch) + rows),
  };
}

/**
 * The rows for pitches `min` to `max`: every one, or folded to just those
 * the notes use, and with `"scale"` those in `scale` as well. A roll with
 * nothing to fold onto keeps every row.
 */
export function rollRows(
  notes: readonly { pitch: number }[],
  min: number,
  max: number,
  fold: boolean | "scale",
  scale: RollScale | null = null
): Rows {
  const classes = scale
    ? [...new Set(scale.pitchClasses.map(pitchClassOf))].sort((a, b) => a - b)
    : null;
  const root = scale ? pitchClassOf(scale.root) : null;
  if (fold) {
    const kept = new Set(notes.map((note) => note.pitch));
    if (fold === "scale" && classes) {
      for (let pitch = min; pitch <= max; pitch += 1) {
        if (classes.includes(((pitch % 12) + 12) % 12)) {
          kept.add(pitch);
        }
      }
    }
    const pitches = [...kept]
      .filter((pitch) => pitch >= min && pitch <= max)
      .sort((a, b) => b - a);
    if (pitches.length > 0) {
      return folded(pitches, classes, root);
    }
  }
  return chromatic(min, max, classes, root);
}
