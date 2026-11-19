/**
 * The computer's keyboard as a keyboard of notes, as in a DAW: the middle row
 * from A plays the white keys and the row above the black ones, Z and X move
 * an octave, C and V the velocity. Keys are read by where they sit
 * (`KeyboardEvent.code`), so the layout of letters does not move them.
 */

/** Semitones from the octave's C, by key. */
const NOTE_KEYS: Readonly<Record<string, number>> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
};

/** The keys that change the octave and the velocity. */
export const COMPUTER_KEYBOARD_CONTROLS = {
  octaveDown: "KeyZ",
  octaveUp: "KeyX",
  velocityDown: "KeyC",
  velocityUp: "KeyV",
} as const;

/** The C the A key plays at octave 0: middle C. */
export const COMPUTER_KEYBOARD_BASE = 60;

/** How far Z and X go, in octaves either way. */
export const COMPUTER_KEYBOARD_OCTAVES = 4;

/** The velocities C and V step through, 0…1. */
export const COMPUTER_KEYBOARD_VELOCITIES = [
  0.2, 0.35, 0.5, 0.65, 0.8, 1,
] as const;

/** The note a key plays at `octave`, or null for a key that plays none; null too past 0 and 127. */
export function noteOfKey(code: string, octave: number): number | null {
  const semitones = NOTE_KEYS[code];
  if (semitones === undefined) {
    return null;
  }
  const note = COMPUTER_KEYBOARD_BASE + octave * 12 + semitones;
  return note >= 0 && note <= 127 ? note : null;
}

/** What a control key changes, by how many steps: an octave (Z, X) or the velocity (C, V); null for any other key. */
export function controlOfKey(
  code: string
): { octave: number } | { velocity: number } | null {
  const controls = COMPUTER_KEYBOARD_CONTROLS;
  switch (code) {
    case controls.octaveDown:
      return { octave: -1 };
    case controls.octaveUp:
      return { octave: 1 };
    case controls.velocityDown:
      return { velocity: -1 };
    case controls.velocityUp:
      return { velocity: 1 };
    default:
      return null;
  }
}

/** Whether a key plays a note or changes the octave or the velocity: what the page's own shortcuts leave to the keyboard of notes. */
export function isComputerKeyboardKey(code: string): boolean {
  return (
    code in NOTE_KEYS ||
    (Object.values(COMPUTER_KEYBOARD_CONTROLS) as string[]).includes(code)
  );
}
