import writeMusicXml, { parse, type TempoPoint } from "@audio/musicxml";
import type { Note } from "@audio-ui/core/piano-roll";
import { strFromU8, unzipSync } from "fflate";
import type { ScoreNote, ScorePart } from "./midi-file.ts";

const SECONDS_PER_MINUTE = 60;
/** The tempo a part with no tempo marks is read at, as the parser reads it. */
const DEFAULT_BPM = 120;
/** A compressed score names its score in this file. */
const CONTAINER = "META-INF/container.xml";
const ROOT_FILE = /<rootfile[^>]*full-path="([^"]+)"/;
/** The grids the writer quantizes to, as the note value of a step. */
const GRIDS = [4, 8, 16, 32];

/** What a file input or a drop zone accepts as a MusicXML file: a score, or one compressed as `.mxl`. */
export const MUSICXML_FILE_ACCEPT =
  ".musicxml,.mxl,.xml,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml";

/** The grid notes are read onto: steps a quarter note, the clip's length in steps, and the pitch and tempo ranges it takes. */
export interface MusicXmlFileGrid {
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
 * The beat a time in seconds falls on, through a part's tempo marks: the
 * parser times each part by its own, so turning them back gives every part
 * the beats it was written in.
 */
function beatOf(seconds: number, tempos: readonly TempoPoint[]) {
  const marks = tempos.length > 0 ? tempos : [{ bpm: DEFAULT_BPM, time: 0 }];
  let beat = 0;
  for (const [index, mark] of marks.entries()) {
    const next = marks[index + 1];
    if (!next || seconds < next.time) {
      return beat + ((seconds - mark.time) * mark.bpm) / SECONDS_PER_MINUTE;
    }
    beat += ((next.time - mark.time) * mark.bpm) / SECONDS_PER_MINUTE;
  }
  return beat;
}

/** A score's text: as it is, or out of the `.mxl` archive that holds it, in UTF-8 or UTF-16 by its byte-order mark. */
async function scoreText(file: Blob) {
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  // A zip begins "PK": a compressed score, its container naming the score inside.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // An archive may hold any files, or none of these: a path can be missing.
    const files: Partial<Record<string, Uint8Array>> = unzipSync(bytes);
    const container = files[CONTAINER];
    const root = container ? ROOT_FILE.exec(strFromU8(container))?.[1] : null;
    const score = root ? files[root] : undefined;
    if (!score) {
      throw new Error("A compressed MusicXML file names no score it holds");
    }
    bytes = score;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Reads a MusicXML score as parts, for a host that lays each on a track of
 * its own: a part each, by its name, its notes in beats as they were
 * written, through changes of tempo, not quantized and not cut. A score, or
 * one compressed as `.mxl`. Grace notes, which take no time, are dropped, and
 * repeats play once, as written. Also its first tempo and its title.
 */
export async function readMusicXmlFileParts(
  file: Blob
): Promise<{ bpm: number; parts: ScorePart[]; title?: string }> {
  const score = parse(await scoreText(file));
  const parts = score.parts.map((part, index) => {
    const notes: ScoreNote[] = [];
    for (const scoreNote of part.notes) {
      if (scoreNote.duration > 0) {
        const start = beatOf(scoreNote.time, part.tempos);
        notes.push({
          length:
            beatOf(scoreNote.time + scoreNote.duration, part.tempos) - start,
          pitch: scoreNote.midi,
          start,
          velocity: scoreNote.velocity,
        });
      }
    }
    return { drums: false, name: part.name || `Part ${index + 1}`, notes };
  });
  return {
    bpm: score.parts[0]?.tempos[0]?.bpm ?? DEFAULT_BPM,
    parts,
    title: score.title,
  };
}

/**
 * Reads a MusicXML score's notes onto a grid of steps, with its first tempo
 * (clamped to the BPM range), every part into the one clip. A score, or one
 * compressed as `.mxl`. Each note is quantized to the nearest step and at
 * least one step long; notes starting past the clip's end are dropped, and so
 * are grace notes, which take no time. Repeats play once, as written.
 */
export async function readMusicXmlFile(
  file: Blob,
  grid: MusicXmlFileGrid
): Promise<{ bpm: number; notes: Note[]; title?: string }> {
  const {
    duration,
    maxBpm = 200,
    maxPitch = 127,
    minBpm = 20,
    minPitch = 0,
    stepsPerQuarter = 4,
  } = grid;
  const score = await readMusicXmlFileParts(file);
  const notes: Note[] = [];
  for (const part of score.parts) {
    for (const scoreNote of part.notes) {
      const start = Math.round(scoreNote.start * stepsPerQuarter);
      if (start < 0 || start >= duration) {
        continue;
      }
      notes.push({
        id: `musicxml-import-${notes.length}`,
        length: clamp(
          Math.round((scoreNote.start + scoreNote.length) * stepsPerQuarter) -
            start,
          1,
          duration - start
        ),
        pitch: clamp(scoreNote.pitch, minPitch, maxPitch),
        start,
        velocity: clamp(scoreNote.velocity, 0, 1),
      });
    }
  }
  return {
    bpm: clamp(Math.round(score.bpm), minBpm, maxBpm),
    notes,
    title: score.title,
  };
}

/**
 * The notes as a MusicXML score, the inverse of `readMusicXmlFile`, for a
 * notation app to open: on the grid they sit on, so nothing moves. Deactivated
 * notes are left out.
 */
export function writeMusicXmlFile(
  notes: readonly Note[],
  {
    bpm,
    stepsPerQuarter = 4,
    title,
  }: { bpm: number; stepsPerQuarter?: number; title?: string }
): string {
  const secondsPerStep = SECONDS_PER_MINUTE / bpm / stepsPerQuarter;
  return writeMusicXml(
    notes
      .filter((note) => !note.muted)
      .map((note) => ({
        duration: note.length * secondsPerStep,
        midi: note.pitch,
        time: note.start * secondsPerStep,
        velocity: note.velocity ?? 1,
      })),
    {
      bpm,
      // A step is a sixteenth at 4 a quarter, a thirty-second at 8; on a grid
      // the writer has no name for, it writes the lengths as they are.
      quantize: GRIDS.includes(stepsPerQuarter * 4) ? stepsPerQuarter * 4 : 0,
      title,
      triplets: false,
    }
  );
}

/** Saves the notes as a `.musicxml` file, named `filename`. */
export function downloadMusicXmlFile(
  notes: readonly Note[],
  options: {
    bpm: number;
    filename?: string;
    stepsPerQuarter?: number;
    title?: string;
  }
) {
  const blob = new Blob([writeMusicXmlFile(notes, options)], {
    type: "application/vnd.recordare.musicxml+xml",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename ?? "clip.musicxml";
  link.click();
  URL.revokeObjectURL(url);
}
