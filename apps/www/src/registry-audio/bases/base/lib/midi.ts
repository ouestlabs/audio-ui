export type MidiEvent =
  | { note: number; type: "noteoff" }
  | { note: number; type: "noteon"; velocity: number }
  | { semitones: number; type: "pitchbend" };

const NOTE_ON_STATUS = 0x90;
const NOTE_OFF_STATUS = 0x80;
const PITCH_BEND_STATUS = 0xe0;
const STATUS_COMMAND_MASK = 0xf0;

const PITCH_BEND_DATA_BITS = 7;
/** 14-bit pitch bend is centered at 8192 (0-16383 range); dividing by this on both sides of center is the standard MIDI convention, accepting the slight asymmetry at the very top of the range. */
const PITCH_BEND_CENTER = 8192;
/** How many semitones a full bend (wheel at either extreme) shifts pitch by — ±2 semitones is the most common default across MIDI keyboards/synths. */
const PITCH_BEND_RANGE_SEMITONES = 2;

/** Parses a raw MIDI message into a note-on/note-off/pitch-bend event, or null for anything else (control change, clock, ...). A note-on with velocity 0 is a note-off, per the MIDI spec convention many keyboards use. */
export function parseMidiMessage(data: Uint8Array | null): MidiEvent | null {
  if (!data) {
    return null;
  }
  const [status, byte1, byte2] = data;
  if (status === undefined || byte1 === undefined) {
    return null;
  }
  const command = status & STATUS_COMMAND_MASK;
  if (command === NOTE_ON_STATUS) {
    return byte2
      ? { note: byte1, type: "noteon", velocity: byte2 }
      : { note: byte1, type: "noteoff" };
  }
  if (command === NOTE_OFF_STATUS) {
    return { note: byte1, type: "noteoff" };
  }
  if (command === PITCH_BEND_STATUS) {
    if (byte2 === undefined) {
      return null;
    }
    const value = (byte2 << PITCH_BEND_DATA_BITS) | byte1;
    const normalized = (value - PITCH_BEND_CENTER) / PITCH_BEND_CENTER;
    return {
      semitones: normalized * PITCH_BEND_RANGE_SEMITONES,
      type: "pitchbend",
    };
  }
  return null;
}
