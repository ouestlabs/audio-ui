const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);

/** "C", "C#", "D"... for the note nearest `pitch`, without its octave. */
export function pitchClassName(pitch: number): string {
  return NAMES[((Math.round(pitch) % 12) + 12) % 12] ?? "";
}

/** "C4" for middle C (MIDI 60), the naming tuners and score editors agree on. */
export function pitchName(pitch: number): string {
  const rounded = Math.round(pitch);
  return `${pitchClassName(rounded)}${Math.floor(rounded / 12) - 1}`;
}

/** Whether `pitch` falls on a black key of a piano. */
export function isBlackKey(pitch: number): boolean {
  return BLACK.has(((Math.round(pitch) % 12) + 12) % 12);
}
