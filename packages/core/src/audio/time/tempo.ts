/**
 * Tempo and time signature: how long a quarter note, a beat and a bar last in
 * seconds, and where a position in seconds falls in bars and beats.
 * Framework-agnostic, so a ruler, a grid and a piano roll can all ask it per
 * frame. A tempo that cannot be a tempo (zero, negative, `NaN`) makes a
 * quarter note infinitely long, so a position in it stays at the start, and a
 * signature that cannot be one reads as 4/4: nothing here throws or divides by
 * zero.
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

const SECONDS_PER_MINUTE = 60;
const MICROSECONDS_PER_SECOND = 1_000_000;
/** What a file with no Set Tempo event plays at: 120 BPM, 500,000 microseconds a quarter note. */
export const DEFAULT_MICROSECONDS_PER_QUARTER_NOTE = 500_000;

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/** Seconds per quarter note: BPM counts quarters whatever the signature says. `Infinity` for a tempo that is not positive and finite. */
export function secondsPerQuarter(tempo: Tempo): number {
  return isPositive(tempo.bpm)
    ? SECONDS_PER_MINUTE / tempo.bpm
    : Number.POSITIVE_INFINITY;
}

/** The note value that gets a beat, 4 when the signature has none that makes sense. */
const beatUnitOf = (tempo: Tempo) =>
  isPositive(tempo.beatUnit) ? tempo.beatUnit : DEFAULT_TEMPO.beatUnit;
const beatsPerBarOf = (tempo: Tempo) =>
  isPositive(tempo.beatsPerBar) ? tempo.beatsPerBar : DEFAULT_TEMPO.beatsPerBar;

/** Seconds per beat, a beat being one `beatUnit` note: in 6/8, half a quarter. */
export function secondsPerBeat(tempo: Tempo): number {
  return secondsPerQuarter(tempo) * (4 / beatUnitOf(tempo));
}

export function secondsPerBar(tempo: Tempo): number {
  return secondsPerBeat(tempo) * beatsPerBarOf(tempo);
}

/** A tempo in BPM as microseconds per quarter note, the unit a MIDI file stores: 120 BPM is 500000. */
export function bpmToMicrosecondsPerQuarterNote(bpm: number): number {
  return (SECONDS_PER_MINUTE * MICROSECONDS_PER_SECOND) / bpm;
}

/** The BPM of a Set Tempo's microseconds per quarter note: 500000 is 120. */
export function microsecondsPerQuarterNoteToBpm(microseconds: number): number {
  return (SECONDS_PER_MINUTE * MICROSECONDS_PER_SECOND) / microseconds;
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
    (Number.isFinite(seconds) ? Math.max(0, seconds) : 0) /
      (secondsPerQuarter(tempo) / 4) +
      1e-9
  );
  const sixteenthsPerBeat = 16 / beatUnitOf(tempo);
  const beatsPerBar = beatsPerBarOf(tempo);
  const beats = Math.floor(sixteenths / sixteenthsPerBeat);
  return {
    bar: Math.floor(beats / beatsPerBar) + 1,
    beat: (beats % beatsPerBar) + 1,
    sixteenth: Math.floor(sixteenths % sixteenthsPerBeat) + 1,
  };
}

/** "Bar 3, beat 2", the way a position is read out to a screen reader. */
export function describeBarsBeats(seconds: number, tempo: Tempo): string {
  const { bar, beat } = barsBeatsAt(seconds, tempo);
  return `Bar ${bar}, beat ${beat}`;
}
