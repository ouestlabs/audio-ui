import { pitchClassName } from "../shared/pitch.ts";

/**
 * The frequency of A4 in hertz that every other note is tuned from: concert
 * pitch, ISO 16. MIDI fixes A4 as note 69 and gives no octave number to the
 * other notes, so "C4" for note 60 is the scientific pitch notation, which
 * some instruments and editors name C3 or C5.
 */
export const CONCERT_PITCH_HZ = 440;

/** MIDI note number of A4. */
const A4_NOTE = 69;
const SEMITONES_PER_OCTAVE = 12;
const CENTS_PER_SEMITONE = 100;

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/**
 * The frequency of a MIDI note in hertz, in equal temperament with A4 (note
 * 69) at `reference`. The note may be fractional: 60.5 is a quarter tone above
 * middle C, and a note `cents` away is `note + cents / 100`. `NaN` when the
 * note or the reference is not a finite number, or the reference is not
 * positive.
 */
export function noteToFrequency(
  note: number,
  reference = CONCERT_PITCH_HZ
): number {
  if (!(Number.isFinite(note) && isPositive(reference))) {
    return Number.NaN;
  }
  return reference * 2 ** ((note - A4_NOTE) / SEMITONES_PER_OCTAVE);
}

/**
 * The inverse: the MIDI note of a frequency, fractional where it falls between
 * notes. `NaN` for a frequency or a reference that is not positive and finite.
 */
export function frequencyToNote(
  frequency: number,
  reference = CONCERT_PITCH_HZ
): number {
  if (!(isPositive(frequency) && isPositive(reference))) {
    return Number.NaN;
  }
  return A4_NOTE + SEMITONES_PER_OCTAVE * Math.log2(frequency / reference);
}

export interface Note {
  /** How far the frequency is from the note, from -50 (flat) to +50 (sharp) cents. */
  cents: number;
  /** The note's name, sharps for the black keys: `"A"`, `"C#"`. */
  name: string;
  /** The octave in scientific pitch notation: middle C is C4. */
  octave: number;
  /** The note as a MIDI note number: A4 is 69. */
  pitch: number;
}

/**
 * The note nearest `frequency`, and how far from it the frequency is, with A4
 * at `reference` hertz. `null` for a frequency or a reference that is not
 * positive and finite: there is no note for silence.
 */
export function nearestNote(
  frequency: number,
  reference = CONCERT_PITCH_HZ
): Note | null {
  const exact = frequencyToNote(frequency, reference);
  if (Number.isNaN(exact)) {
    return null;
  }
  const pitch = Math.round(exact);
  return {
    cents: (exact - pitch) * CENTS_PER_SEMITONE,
    name: pitchClassName(pitch),
    octave: Math.floor(pitch / SEMITONES_PER_OCTAVE) - 1,
    pitch,
  };
}
