/**
 * The chords Sera-27 knows: nine roots, round the circle of fifths from E flat
 * to B, each major, minor and seventh, a button each. A chord gives the notes
 * of the pad that sustains it, the bass that walks under it, and the thirteen
 * strings of the plate, its notes rising from G3 up four octaves.
 */

export type Quality = "major" | "minor" | "seventh";
export const QUALITIES: readonly Quality[] = ["major", "minor", "seventh"];
/** The roots as pitch classes, in the order of the buttons: a fifth apart. */
export const ROOTS = [3, 10, 5, 0, 7, 2, 9, 4, 11] as const;
export const STRINGS = 13;

const INTERVALS: Record<Quality, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  seventh: [0, 4, 7, 10],
};
const SUFFIX: Record<Quality, string> = { major: "", minor: "m", seventh: "7" };
/** Where the plate's lowest string may start, G3, and the pad's voicing, around middle C. */
const PLATE_FLOOR = 55;
const PAD_FLOOR = 52;
const BASS_OCTAVE = 36;

export interface Chord {
  quality: Quality;
  root: number;
}

/** The roots' names, as the panel prints them: flats, since the circle starts on E flat. */
const NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const rootName = (root: number) => NAMES[root] ?? "C";

export const chordName = ({ quality, root }: Chord) =>
  `${rootName(root)}${SUFFIX[quality]}`;

const FLAT = /^(.)b$/;

/** What a screen reader hears for a chord: `B flat minor`. */
export const chordSpoken = ({ quality, root }: Chord) =>
  `${rootName(root).replace(FLAT, "$1 flat")} ${quality}`;

const inChord = ({ quality, root }: Chord, pitch: number) =>
  INTERVALS[quality].includes((((pitch - root) % 12) + 12) % 12);

/** The plate's strings for a chord: its notes, low to high, from G3 up. */
export function stringsOf(chord: Chord) {
  const strings: number[] = [];
  for (let pitch = PLATE_FLOOR; strings.length < STRINGS; pitch += 1) {
    if (inChord(chord, pitch)) {
      strings.push(pitch);
    }
  }
  return strings;
}

/** The pad's notes for a chord: one of each, close together, from E3 up. */
export function padOf(chord: Chord) {
  const notes: number[] = [];
  for (
    let pitch = PAD_FLOOR;
    notes.length < INTERVALS[chord.quality].length;
    pitch += 1
  ) {
    if (inChord(chord, pitch)) {
      notes.push(pitch);
    }
  }
  return notes;
}

/** The bass for a chord: its root, or its fifth, in the second octave. */
export const bassOf = ({ root }: Chord, degree: "fifth" | "root") =>
  BASS_OCTAVE + ((root + (degree === "fifth" ? 7 : 0)) % 12);
