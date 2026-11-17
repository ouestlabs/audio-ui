/** The note names of a pitch class, from C. */
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);

/** The pitch class of `pitch`, 0 for C to 11 for B. */
const classOf = (pitch: number) => ((Math.round(pitch) % 12) + 12) % 12;

/** "C", "C#", "D"... for the note nearest `pitch`, without its octave. */
export function pitchClassName(pitch: number) {
  return NAMES[classOf(pitch)] ?? "";
}

/** "C4" for middle C (MIDI 60), the naming tuners and score editors agree on. */
export function pitchName(pitch: number) {
  const rounded = Math.round(pitch);
  return `${pitchClassName(rounded)}${Math.floor(rounded / 12) - 1}`;
}

/** Whether `pitch` falls on a black key of a piano. */
export const isBlackKey = (pitch: number) => BLACK.has(classOf(pitch));
