/**
 * Live MIDI 1.0 channel messages, as a Web MIDI input delivers them (one
 * message per event, a status byte then its data bytes). Values are
 * normalized the way the rest of audio/ui reads them: velocity and controller
 * values from 0 to 1, pitch bend from -1 to 1. The byte a device sent is
 * `Math.round(value * 127)`.
 */
export type MidiMessage =
  | {
      channel: number;
      /** The controller number: 1 is the mod wheel, 7 volume, 64 sustain, 123 all notes off. */
      controller: number;
      type: "controlchange";
      /** 0 to 1. A switch such as the sustain pedal is on from 0.5, the byte 64. */
      value: number;
    }
  | {
      channel: number;
      note: number;
      type: "noteoff";
      /** The release velocity, 0 to 1: 0 when a note-on with velocity 0 stood for the note-off. */
      velocity: number;
    }
  | { channel: number; note: number; type: "noteon"; velocity: number }
  | {
      channel: number;
      type: "pitchbend";
      /** -1 (wheel fully down) to 1 (fully up), 0 at rest. Both ends are reached. */
      value: number;
    };

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
const PITCH_BEND = 0xe0;
const COMMAND_MASK = 0xf0;
const CHANNEL_MASK = 0x0f;
const DATA_BYTE_MAX = 127;
const PITCH_BEND_DATA_BITS = 7;
const PITCH_BEND_CENTER = 8192;
const PITCH_BEND_MAX = 16_383;

/** The bend range most synths start with, in semitones. A receiver sets its own, with RPN 0. */
export const DEFAULT_PITCH_BEND_RANGE = 2;

/**
 * Parses one channel voice message: note on, note off, control change or
 * pitch bend. `null` for everything else (program change, aftertouch, system
 * and real-time messages such as the clock) and for bytes that are not a
 * well-formed message: a data byte with its high bit set, or too few bytes.
 * A note-on with velocity 0 is a note-off, as the MIDI spec has it.
 */
export function parseMidiMessage(
  data: ArrayLike<number> | null | undefined
): MidiMessage | null {
  if (!data || data.length < 3) {
    return null;
  }
  const status = data[0] ?? 0;
  const first = data[1] ?? 0;
  const second = data[2] ?? 0;
  if (status < NOTE_OFF || first > DATA_BYTE_MAX || second > DATA_BYTE_MAX) {
    return null;
  }
  const channel = status & CHANNEL_MASK;
  switch (status & COMMAND_MASK) {
    case NOTE_ON:
      return second === 0
        ? { channel, note: first, type: "noteoff", velocity: 0 }
        : {
            channel,
            note: first,
            type: "noteon",
            velocity: second / DATA_BYTE_MAX,
          };
    case NOTE_OFF:
      return {
        channel,
        note: first,
        type: "noteoff",
        velocity: second / DATA_BYTE_MAX,
      };
    case CONTROL_CHANGE:
      return {
        channel,
        controller: first,
        type: "controlchange",
        value: second / DATA_BYTE_MAX,
      };
    case PITCH_BEND: {
      // 14 bits, the least significant seven first. The centre, 8192, is not
      // the middle of 0 to 16383, so each side is scaled to reach its own end.
      const raw = (second << PITCH_BEND_DATA_BITS) | first;
      const value =
        raw >= PITCH_BEND_CENTER
          ? (raw - PITCH_BEND_CENTER) / (PITCH_BEND_MAX - PITCH_BEND_CENTER)
          : (raw - PITCH_BEND_CENTER) / PITCH_BEND_CENTER;
      return { channel, type: "pitchbend", value };
    }
    default:
      return null;
  }
}

/** A pitch bend value in semitones, for a receiver whose bend range is `range` semitones each way. */
export function pitchBendToSemitones(
  value: number,
  range = DEFAULT_PITCH_BEND_RANGE
): number {
  return value * range;
}
