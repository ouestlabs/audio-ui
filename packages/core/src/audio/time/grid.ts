/**
 * The musical grid a timeline draws and snaps to: note-value divisions that
 * follow the tempo, how they are named, the rhythms of a metronome and how far
 * apart a ruler labels its bars. All of it a function of seconds and zoom, with
 * no view in it.
 */

import {
  secondsPerBar,
  secondsPerBeat,
  secondsPerQuarter,
  type Tempo,
} from "./tempo.ts";

/** The fixed grid divisions, coarsest first: a number of bars, or a note value. */
export const GRID_DIVISIONS = [
  { bars: 4, id: "4-bars" },
  { bars: 2, id: "2-bars" },
  { bars: 1, id: "1-bar" },
  { id: "1/2", note: 2 },
  { id: "1/4", note: 4 },
  { id: "1/8", note: 8 },
  { id: "1/16", note: 16 },
  { id: "1/32", note: 32 },
] as const;

export type FixedGridDivision = (typeof GRID_DIVISIONS)[number]["id"];

/** `adaptive` follows the zoom; a fixed division stays put however far you zoom. */
export type GridDivision = "adaptive" | FixedGridDivision;

/** Three in the space of two: a triplet division is 2/3 of its straight one. */
export const TRIPLET_FACTOR = 2 / 3;

/** How long one fixed division lasts at `tempo`, in seconds. */
export function divisionSeconds(
  division: FixedGridDivision,
  tempo: Tempo
): number {
  const found = GRID_DIVISIONS.find((entry) => entry.id === division);
  if (!found) {
    return secondsPerBar(tempo);
  }
  // A note value is a share of a whole note, which is four quarters
  // whatever the signature says; a bar follows the signature.
  return "bars" in found
    ? found.bars * secondsPerBar(tempo)
    : (4 / found.note) * secondsPerQuarter(tempo);
}

export interface GridIntervalOptions {
  /** The closest two adaptive lines may be, in px. @default 24 */
  minSpacing?: number;
  triplet?: boolean;
}

/**
 * Seconds between grid lines at `zoom` px per second: the lines a timeline
 * draws and the step it snaps to, so what you see is where you land. A
 * fixed division ignores the zoom; `adaptive` picks the finest division
 * still far enough from its neighbour to be aimed at.
 */
export function gridInterval(
  division: GridDivision,
  zoom: number,
  tempo: Tempo,
  { minSpacing = 24, triplet = false }: GridIntervalOptions = {}
): number {
  const factor = triplet ? TRIPLET_FACTOR : 1;
  if (division !== "adaptive") {
    return divisionSeconds(division, tempo) * factor;
  }
  const finestFirst = GRID_DIVISIONS.map((entry) =>
    divisionSeconds(entry.id, tempo)
  ).reverse();
  for (const seconds of finestFirst) {
    // Measured after the triplet, or a ternary grid would be drawn a third
    // denser than a grid is allowed to be.
    if (seconds * factor * zoom >= minSpacing) {
      return seconds * factor;
    }
  }
  return (finestFirst.at(-1) ?? secondsPerBar(tempo)) * factor;
}

const LABEL_TOLERANCE = 1e-6;

/** `value` as a whole number of at least one, or null if it is not one. */
function whole(value: number): number | null {
  const rounded = Math.round(value);
  return rounded >= 1 && Math.abs(value - rounded) < LABEL_TOLERANCE
    ? rounded
    : null;
}

/** The note value a count of quarters is, when it is a halving of a whole note. */
function noteDenominator(quarters: number): number | null {
  const denominator = whole(4 / quarters);
  return denominator !== null && (denominator & (denominator - 1)) === 0
    ? denominator
    : null;
}

function barsName(bars: number): string {
  return bars === 1 ? "1 bar" : `${bars} bars`;
}

/**
 * Names an interval the way a grid readout does: "1 bar", "4 bars", "1/16",
 * "1/8T". It works from the interval rather than from a setting, so the
 * adaptive grid, which has no name of its own, reads out the division it has
 * landed on, and a menu and a readout cannot name one grid two ways.
 */
export function gridLabel(seconds: number, tempo: Tempo): string {
  const bars = seconds / secondsPerBar(tempo);
  const straightBars = whole(bars);
  if (straightBars !== null) {
    return barsName(straightBars);
  }
  const quarters = seconds / secondsPerQuarter(tempo);
  const note = noteDenominator(quarters);
  if (note !== null) {
    return `1/${note}`;
  }
  const tripletBars = whole(bars / TRIPLET_FACTOR);
  if (tripletBars !== null) {
    return `${barsName(tripletBars)} T`;
  }
  const tripletNote = noteDenominator(quarters / TRIPLET_FACTOR);
  if (tripletNote !== null) {
    return `1/${tripletNote}T`;
  }
  const beats = Number((seconds / secondsPerBeat(tempo)).toFixed(2));
  return `${beats} beats`;
}

/**
 * How often a metronome clicks: with the beat, or a note value, straight or
 * triplet. `denominator` is the note value (1 is a bar), `0` follows the beat.
 */
export const METRONOME_RHYTHMS = [
  { denominator: 0, id: "auto", triplet: false },
  { denominator: 1, id: "1-bar", triplet: false },
  { denominator: 2, id: "1/2", triplet: false },
  { denominator: 2, id: "1/2t", triplet: true },
  { denominator: 4, id: "1/4", triplet: false },
  { denominator: 4, id: "1/4t", triplet: true },
  { denominator: 8, id: "1/8", triplet: false },
  { denominator: 8, id: "1/8t", triplet: true },
  { denominator: 16, id: "1/16", triplet: false },
  { denominator: 16, id: "1/16t", triplet: true },
] as const;

export type MetronomeRhythm = (typeof METRONOME_RHYTHMS)[number]["id"];

/**
 * Seconds between clicks for a rhythm, or `null` for `auto`, which has no
 * interval of its own: it is the beat, whatever the signature makes one.
 */
export function metronomeRhythmSeconds(
  rhythm: MetronomeRhythm,
  tempo: Tempo
): number | null {
  const found = METRONOME_RHYTHMS.find((entry) => entry.id === rhythm);
  if (!found || found.denominator === 0) {
    return null;
  }
  const straight =
    found.denominator === 1
      ? secondsPerBar(tempo)
      : (4 / found.denominator) * secondsPerQuarter(tempo);
  return found.triplet ? straight * TRIPLET_FACTOR : straight;
}

/**
 * Seconds between labelled bars on a ruler at `zoom` px per second: always a
 * whole number of bars, doubled until labels are at least `minSpacing` px
 * apart, so they never collide or fall mid-bar.
 */
export function barLabelInterval(
  zoom: number,
  tempo: Tempo,
  minSpacing = 64
): number {
  const bar = secondsPerBar(tempo);
  let interval = bar;
  while (interval * zoom < minSpacing && interval < bar * 1024) {
    interval *= 2;
  }
  return interval;
}

/** A straight note value, in the form a time parameter lists it. */
const SYNCED_NOTES = [32, 16, 8, 4, 2, 1] as const;

/** Three halves: a dotted note is its straight one and half again. */
export const DOTTED_FACTOR = 3 / 2;

/**
 * The note values a time parameter that follows the tempo can take, shortest
 * first: `1/16` is a sixteenth note, `1/8t` a triplet eighth (two thirds of
 * it) and `1/8d` a dotted eighth (one and a half times it). The `value` goes in
 * a device's state, the `label` is what a panel shows.
 */
export const SYNCED_DIVISIONS = SYNCED_NOTES.flatMap((note) => {
  const name = note === 1 ? "1/1" : `1/${note}`;
  return [
    { label: `${name} triplet`, value: `${name}t` },
    { label: name, value: name },
    { label: `${name} dotted`, value: `${name}d` },
  ];
});

export type SyncedDivision = string;

/**
 * How long a synced note value lasts at `tempo`, in seconds: `1/8` an eighth,
 * `1/8t` its triplet, `1/8d` its dotted one. A value that is not in
 * `SYNCED_DIVISIONS` is read as a quarter note, so a stale state still sounds
 * on the beat instead of at zero.
 */
export function syncedSeconds(division: SyncedDivision, tempo: Tempo): number {
  const match = /^1\/(\d+)([td]?)$/.exec(division);
  const note = match ? Number(match[1]) : 4;
  const suffix = match?.[2] ?? "";
  let factor = 1;
  if (suffix === "t") {
    factor = TRIPLET_FACTOR;
  } else if (suffix === "d") {
    factor = DOTTED_FACTOR;
  }
  return (4 / note) * secondsPerQuarter(tempo) * factor;
}
