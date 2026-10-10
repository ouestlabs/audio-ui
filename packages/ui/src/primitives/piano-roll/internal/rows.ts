/**
 * The rows a piano roll draws, highest pitch first, and the conversions
 * between a pitch and its row. Folding is nothing but a different list of
 * rows: every part reads its geometry from here.
 */
export interface Rows {
  /** Whether only the pitches carrying notes are drawn. */
  folded: boolean;
  /** The pitch on `row`, carrying on by semitones past either end. */
  pitchAt: (row: number) => number;
  /** Highest first, which is top to bottom on screen. */
  pitches: readonly number[];
  /** The row `pitch` is drawn on; a pitch with no row of its own sits on the row it would be inserted at. */
  rowOf: (pitch: number) => number;
  /** Where a note at `pitch` lands after moving `rows` rows down (negative is up). */
  step: (pitch: number, rows: number) => number;
}

/** Every pitch from `max` down to `min`. */
function chromatic(min: number, max: number): Rows {
  const pitches: number[] = [];
  for (let pitch = max; pitch >= min; pitch -= 1) {
    pitches.push(pitch);
  }
  return {
    folded: false,
    pitchAt: (row) => max - row,
    pitches,
    rowOf: (pitch) => max - pitch,
    step: (pitch, rows) => pitch - rows,
  };
}

/** Only `pitches` (highest first), continuing by semitones past either end. */
function folded(pitches: number[]): Rows {
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
    rowOf,
    step: (pitch, rows) => pitchAt(rowOf(pitch) + rows),
  };
}

/**
 * The rows for pitches `min` to `max`: every one, or folded to just those
 * the notes use. A roll with no notes has nothing to fold onto and keeps
 * every row.
 */
export function rollRows(
  notes: readonly { pitch: number }[],
  min: number,
  max: number,
  fold: boolean
): Rows {
  if (fold) {
    const used = [...new Set(notes.map((note) => note.pitch))]
      .filter((pitch) => pitch >= min && pitch <= max)
      .sort((a, b) => b - a);
    if (used.length > 0) {
      return folded(used);
    }
  }
  return chromatic(min, max);
}
