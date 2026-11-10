import writeMusicXml, { parse, type TempoPoint } from "@audio/musicxml";
import type { Note } from "@audio-ui/core/piano-roll";

const SECONDS_PER_MINUTE = 60;
/** The tempo a part with no tempo marks is read at, as the parser reads it. */
const DEFAULT_BPM = 120;
const ZIP_LOCAL_HEADER = 0x04_03_4b_50;
const ZIP_DIRECTORY_END = 0x06_05_4b_50;
const ZIP_DIRECTORY_ENTRY = 0x02_01_4b_50;
const STORED = 0;
const DEFLATED = 8;
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

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** Where a file's bytes are in a zip archive, by its name, and how they are stored. */
function zipEntry(archive: Uint8Array, name: string) {
  const data = view(archive);
  // The directory ends in the last 22 bytes, or before a comment of up to 64 KB.
  let end = archive.length - 22;
  while (end >= 0 && data.getUint32(end, true) !== ZIP_DIRECTORY_END) {
    end -= 1;
  }
  if (end < 0) {
    throw new Error("A compressed MusicXML file needs its zip directory");
  }
  const count = data.getUint16(end + 10, true);
  let entry = data.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    if (data.getUint32(entry, true) !== ZIP_DIRECTORY_ENTRY) {
      break;
    }
    const nameLength = data.getUint16(entry + 28, true);
    const offset = data.getUint32(entry + 42, true);
    const entryName = decoder.decode(
      archive.subarray(entry + 46, entry + 46 + nameLength)
    );
    if (
      entryName === name &&
      data.getUint32(offset, true) === ZIP_LOCAL_HEADER
    ) {
      const start =
        offset +
        30 +
        data.getUint16(offset + 26, true) +
        data.getUint16(offset + 28, true);
      return {
        method: data.getUint16(entry + 10, true),
        packed: archive.slice(start, start + data.getUint32(entry + 20, true)),
      };
    }
    entry +=
      46 +
      nameLength +
      data.getUint16(entry + 30, true) +
      data.getUint16(entry + 32, true);
  }
  throw new Error(`A compressed MusicXML file has no ${name}`);
}

/** A file's bytes out of a zip archive, by its name, inflated when it is deflated. */
async function unzipped(archive: Uint8Array, name: string) {
  const { method, packed } = zipEntry(archive, name);
  if (method === STORED) {
    return packed;
  }
  if (method !== DEFLATED) {
    throw new Error(
      `A compressed MusicXML file stores ${name} in a way it cannot open`
    );
  }
  const stream = new Blob([packed])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A score's text: as it is, or out of the `.mxl` archive that holds it, in UTF-8 or UTF-16 by its byte-order mark. */
async function scoreText(file: Blob) {
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 4 && view(bytes).getUint32(0, true) === ZIP_LOCAL_HEADER) {
    const container = new TextDecoder().decode(
      await unzipped(bytes, CONTAINER)
    );
    const root = ROOT_FILE.exec(container)?.[1];
    if (!root) {
      throw new Error("A compressed MusicXML file names no score");
    }
    bytes = await unzipped(bytes, root);
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
  const score = parse(await scoreText(file));
  const [first] = score.parts;
  const bpm = clamp(
    Math.round(first?.tempos[0]?.bpm ?? DEFAULT_BPM),
    minBpm,
    maxBpm
  );
  const notes: Note[] = [];
  for (const part of score.parts) {
    for (const scoreNote of part.notes) {
      if (scoreNote.duration <= 0) {
        continue;
      }
      const onset = beatOf(scoreNote.time, part.tempos);
      const end = beatOf(scoreNote.time + scoreNote.duration, part.tempos);
      const start = Math.round(onset * stepsPerQuarter);
      if (start < 0 || start >= duration) {
        continue;
      }
      notes.push({
        id: `musicxml-import-${notes.length}`,
        length: clamp(
          Math.round(end * stepsPerQuarter) - start,
          1,
          duration - start
        ),
        pitch: clamp(scoreNote.midi, minPitch, maxPitch),
        start,
        velocity: clamp(scoreNote.velocity, 0, 1),
      });
    }
  }
  return { bpm, notes, title: score.title };
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
