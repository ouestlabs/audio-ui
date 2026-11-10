import parseMidi from "@audio/midi-parse";
import {
  encodeMidiFile,
  type MidiFileNote,
  parseMidiFile,
} from "@audio-ui/core/midi";
import type { Note } from "@audio-ui/core/piano-roll";

/** Standard MIDI File resolution, ticks per quarter note, a common round value shared by most DAWs' own exports. */
const TICKS_PER_QUARTER_NOTE = 480;
const MICROSECONDS_PER_MINUTE = 60_000_000;

/** What a file input or a drop zone accepts as a MIDI file. */
export const MIDI_FILE_ACCEPT = ".mid,.midi,audio/midi,audio/x-midi";

/** The grid notes are read onto: steps a quarter note, the clip's length in steps, and the pitch and tempo ranges it takes. */
export interface MidiFileGrid {
  /** The clip's length, in steps: notes starting past it are dropped. */
  duration: number;
  /** @default 200 */
  maxBpm?: number;
  /** @default 127 */
  maxPitch?: number;
  /** @default 20 */
  minBpm?: number;
  /** @default 0 */
  minPitch?: number;
  /** Steps in a quarter note: 4 makes a step a sixteenth. @default 4 */
  stepsPerQuarter?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Reads a MIDI file's notes onto a grid of steps, with the file's own tempo
 * (clamped to the BPM range). Each note is quantized to the nearest step and
 * at least one step long; notes starting past the clip's end are dropped.
 */
export async function readMidiFile(
  file: Blob,
  grid: MidiFileGrid
): Promise<{ bpm: number; notes: Note[] }> {
  const {
    duration,
    maxBpm = 200,
    maxPitch = 127,
    minBpm = 20,
    minPitch = 0,
    stepsPerQuarter = 4,
  } = grid;
  const parsed = parseMidiFile(await file.arrayBuffer());
  const bpm = clamp(
    Math.round(MICROSECONDS_PER_MINUTE / parsed.microsecondsPerQuarterNote),
    minBpm,
    maxBpm
  );
  const ticksPerStep = parsed.ticksPerQuarterNote / stepsPerQuarter;

  const notes: Note[] = [];
  for (const midiNote of parsed.notes) {
    const start = Math.round(midiNote.startTick / ticksPerStep);
    if (start < 0 || start >= duration) {
      continue;
    }
    notes.push({
      id: `midi-import-${notes.length}`,
      length: clamp(
        Math.round(midiNote.durationTicks / ticksPerStep),
        1,
        duration - start
      ),
      pitch: clamp(midiNote.note, minPitch, maxPitch),
      start,
      velocity: clamp(midiNote.velocity, 0, 1),
    });
  }
  return { bpm, notes };
}

/** A note of a score in beats: where it starts and how long it lasts, in quarter notes. */
export interface ScoreNote {
  length: number;
  pitch: number;
  start: number;
  /** 0 to 1. */
  velocity: number;
}

/** One part of a score: its name, whether it is drums, and its notes in beats. */
export interface ScorePart {
  /** On MIDI channel 10, the drums of General MIDI. */
  drums: boolean;
  name: string;
  notes: ScoreNote[];
  /** The General MIDI program it asks for, 0 to 127, when it names one: 0 is a piano, 32 a bass. */
  program?: number;
}

/** MIDI's channel 10, counted from 0: the drums. */
const DRUM_CHANNEL = 9;
const MICROSECONDS_PER_SECOND = 1_000_000;
const META_TRACK_NAME = 3;

/**
 * Reads a MIDI file as parts, for a host that lays each on a track of its
 * own: a part per track and channel, named after its track (and its channel,
 * when a track holds several), its notes in beats as they were written, not
 * quantized and not cut, at least a tick long, and the first program its
 * channel plays. Also the file's first tempo, unrounded. The file is parsed
 * by `@audio/midi-parse`.
 */
export async function readMidiFileParts(
  file: Blob
): Promise<{ bpm: number; parts: ScorePart[] }> {
  const parsed = parseMidi(new Uint8Array(await file.arrayBuffer()));
  // The parser times notes in seconds: its tempo map turns them back into beats.
  const beatOf = (seconds: number) => {
    let [mark] = parsed.tempos;
    for (const tempo of parsed.tempos) {
      if (tempo.time > seconds) {
        break;
      }
      mark = tempo;
    }
    if (!mark) {
      return 0;
    }
    return (
      mark.tick / parsed.division +
      ((seconds - mark.time) * MICROSECONDS_PER_SECOND) / mark.usPerBeat
    );
  };
  const byPart = new Map<number, ScoreNote[]>();
  for (const midiNote of parsed.notes) {
    const key = midiNote.track * 16 + midiNote.channel;
    const notes = byPart.get(key) ?? [];
    const start = beatOf(midiNote.time);
    notes.push({
      length: Math.max(
        1 / parsed.division,
        beatOf(midiNote.time + midiNote.duration) - start
      ),
      pitch: midiNote.midi,
      start,
      velocity: midiNote.velocity,
    });
    byPart.set(key, notes);
  }
  const keys = [...byPart.keys()].sort((a, b) => a - b);
  const channelsOf = (track: number) =>
    keys.filter((key) => Math.floor(key / 16) === track).length;
  const events = parsed.tracks.map((track, index) => ({ index, track }));
  const programOf = (track: number, channel: number) => {
    // On its own track first; a format 0 file, or a tempo track, may set it elsewhere.
    for (const onItsOwn of [true, false]) {
      for (const { index, track: list } of events) {
        if (onItsOwn && index !== track) {
          continue;
        }
        const event = list.find(
          (each) => each.type === "program" && each.channel === channel
        );
        if (typeof event?.program === "number") {
          return event.program;
        }
      }
    }
  };
  const nameOf = (track: number) => {
    const event = parsed.tracks[track]?.find(
      (each) => each.type === "meta" && each.meta === META_TRACK_NAME
    );
    return typeof event?.text === "string" ? event.text.trim() : "";
  };
  const [first] = parsed.tempos;
  return {
    bpm: first ? MICROSECONDS_PER_MINUTE / first.usPerBeat : 120,
    parts: keys.map((key) => {
      const track = Math.floor(key / 16);
      const channel = key % 16;
      const named = nameOf(track) || `Track ${track + 1}`;
      const program = programOf(track, channel);
      return {
        drums: channel === DRUM_CHANNEL,
        name:
          channelsOf(track) > 1 ? `${named}, channel ${channel + 1}` : named,
        notes: byPart.get(key) ?? [],
        ...(program === undefined ? {} : { program }),
      };
    }),
  };
}

/** The notes as a Standard MIDI File, the inverse of `readMidiFile`. Deactivated notes are left out. */
export function writeMidiFile(
  notes: readonly Note[],
  { bpm, stepsPerQuarter = 4 }: { bpm: number; stepsPerQuarter?: number }
): Uint8Array {
  const ticksPerStep = TICKS_PER_QUARTER_NOTE / stepsPerQuarter;
  const midiNotes: Omit<MidiFileNote, "track">[] = notes
    .filter((note) => !note.muted)
    .map((note) => ({
      channel: 0,
      durationTicks: Math.round(note.length * ticksPerStep),
      note: note.pitch,
      startTick: Math.round(note.start * ticksPerStep),
      velocity: note.velocity ?? 1,
    }));
  return encodeMidiFile({
    bpm,
    notes: midiNotes,
    ticksPerQuarterNote: TICKS_PER_QUARTER_NOTE,
  });
}

/** Saves the notes as a `.mid` file, named `filename`. */
export function downloadMidiFile(
  notes: readonly Note[],
  options: { bpm: number; filename?: string; stepsPerQuarter?: number }
) {
  const bytes = writeMidiFile(notes, options);
  // `Uint8Array`'s `.buffer` types as `ArrayBufferLike` (which also covers
  // `SharedArrayBuffer`) while `BlobPart` wants a concrete `ArrayBuffer`,
  // safe here since `encodeMidiFile` always builds a fresh, non-shared one.
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename ?? "clip.mid";
  link.click();
  URL.revokeObjectURL(url);
}
