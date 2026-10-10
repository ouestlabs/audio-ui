/**
 * Musical time for a timeline: bars and beats against the seconds audio runs
 * in, and the grid a timeline draws and snaps to. Framework-free, so the
 * ruler, the grid and a piano roll can all ask it per frame.
 */

export interface Tempo {
  /** Beats in a bar: the time signature's numerator. */
  beatsPerBar: number;
  /** Which note value gets one beat: the denominator. 4 is a quarter. */
  beatUnit: number;
  /** Quarter notes per minute, the usual meaning of a BPM field. */
  bpm: number;
}

export const DEFAULT_TEMPO: Tempo = { beatsPerBar: 4, beatUnit: 4, bpm: 120 };

/** Seconds per quarter note: BPM counts quarters whatever the signature says. */
export function secondsPerQuarter(tempo: Tempo): number {
  return 60 / Math.max(tempo.bpm, Number.MIN_VALUE);
}

/** Seconds per beat, a beat being one `beatUnit` note: in 6/8, half a quarter. */
export function secondsPerBeat(tempo: Tempo): number {
  return secondsPerQuarter(tempo) * (4 / tempo.beatUnit);
}

export function secondsPerBar(tempo: Tempo): number {
  return secondsPerBeat(tempo) * tempo.beatsPerBar;
}

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

export interface BarsBeats {
  /** One-based, the way every DAW counts them. */
  bar: number;
  beat: number;
  /** Sixteenth within the beat, also from one. */
  sixteenth: number;
}

/** Where `seconds` falls in bars, beats and sixteenths, each counted from one. */
export function barsBeatsAt(seconds: number, tempo: Tempo): BarsBeats {
  // Nudged past the representation error before flooring, so a position
  // exactly on a beat never reads as the end of the one before.
  const sixteenths = Math.floor(
    Math.max(0, seconds) / (secondsPerQuarter(tempo) / 4) + 1e-9
  );
  const sixteenthsPerBeat = 16 / tempo.beatUnit;
  const beats = Math.floor(sixteenths / sixteenthsPerBeat);
  return {
    bar: Math.floor(beats / tempo.beatsPerBar) + 1,
    beat: (beats % tempo.beatsPerBar) + 1,
    sixteenth: Math.floor(sixteenths % sixteenthsPerBeat) + 1,
  };
}

/** "Bar 3, beat 2", the way a position is read out to a screen reader. */
export function describeBarsBeats(seconds: number, tempo: Tempo): string {
  const { bar, beat } = barsBeatsAt(seconds, tempo);
  return `Bar ${bar}, beat ${beat}`;
}
