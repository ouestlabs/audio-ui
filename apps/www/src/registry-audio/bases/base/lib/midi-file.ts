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
