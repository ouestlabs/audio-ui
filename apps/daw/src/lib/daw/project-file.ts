/**
 * The project as a folder on disk (PRJ-006): `<name>.audioui`, the document,
 * and `Samples/`, the audio files it plays, as they were dropped in. The
 * document is UTF-8 JSON with its `format` and `version` at the top, and
 * names each sample by its path in the folder.
 */
import { renamePadRecordings } from "@/lib/arrangement";
import type { ArrangementDoc } from "@/lib/arrangement-state";

import { withUniqueTrackIds } from "./project";

export const PROJECT_FORMAT = "audio-ui-daw";
export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = ".audioui";
export const SAMPLES = "Samples";

/** A recording of the project, by the id its clips name it by, and where its file is in the folder. */
export interface ProjectSample {
  id: string;
  name: string;
  /** From the project's folder, such as `Samples/Kick.wav`. */
  path: string;
}

export interface ProjectFile {
  doc: ArrangementDoc;
  format: typeof PROJECT_FORMAT;
  samples: ProjectSample[];
  version: typeof PROJECT_VERSION;
}

/** The document of a project, as it is written to its `.audioui` file. */
export function writeProjectFile(
  doc: ArrangementDoc,
  samples: readonly ProjectSample[]
): string {
  const file: ProjectFile = {
    doc,
    format: PROJECT_FORMAT,
    samples: [...samples],
    version: PROJECT_VERSION,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** A project's document read back; it throws, saying why, on a file of another kind or a version it does not know. */
export function readProjectFile(text: string): ProjectFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("This is not a project file: it is not JSON.", {
      cause: error,
    });
  }
  const file = parsed as Partial<ProjectFile> | null;
  if (file?.format !== PROJECT_FORMAT) {
    throw new Error("This is not an audio/ui project file.");
  }
  if (file.version !== PROJECT_VERSION) {
    throw new Error(
      `This project was saved by another version (${String(file.version)}): open it with that version.`
    );
  }
  if (!(file.doc && Array.isArray(file.samples))) {
    throw new Error("This project file is incomplete.");
  }
  return { ...file, doc: withUniqueTrackIds(file.doc) } as ProjectFile;
}

/** The extension of an audio file, from its first bytes: what a sample is named with in the folder. */
export function sniffExtension(bytes: ArrayBuffer): string {
  const head = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  const text = String.fromCharCode(...head);
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") {
    return "wav";
  }
  if (text.startsWith("FORM")) {
    return "aiff";
  }
  if (text.startsWith("fLaC")) {
    return "flac";
  }
  if (text.startsWith("OggS")) {
    return "ogg";
  }
  if (text.slice(4, 8) === "ftyp") {
    return "m4a";
  }
  if (
    text.startsWith("ID3") ||
    (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0)
  ) {
    return "mp3";
  }
  return "audio";
}

/** A file name for a sample in `Samples/` that none of `taken` has: its name, then " 2", " 3"… */
export function sampleFileName(
  name: string,
  extension: string,
  taken: ReadonlySet<string>
): string {
  let file = `${name}.${extension}`;
  for (let n = 2; taken.has(file); n += 1) {
    file = `${name} ${n}.${extension}`;
  }
  return file;
}

/** A number of a file saved under a name already taken, as `sampleFileName` adds it. */
const WHOLE_NUMBER = /^\d+$/;

/**
 * The files of `files` a recording named `name` may already be saved as: its
 * own name, and the numbered ones `sampleFileName` gives when that is taken.
 * Saving again looks there first for a file of the same bytes, so a project
 * saved twice keeps one file per recording.
 */
export function savedAs(
  name: string,
  extension: string,
  files: readonly string[]
): string[] {
  const plain = `${name}.${extension}`;
  return files.filter((file) => {
    if (file === plain) {
      return true;
    }
    const prefix = `${name} `;
    const suffix = `.${extension}`;
    if (!(file.startsWith(prefix) && file.endsWith(suffix))) {
      return false;
    }
    return WHOLE_NUMBER.test(
      file.slice(prefix.length, file.length - suffix.length)
    );
  });
}

/**
 * The project with every recording under a new id from `fresh`, in its
 * samples, in the clips and in the drum racks' pads that play them: what opening it gives, so its ids
 * never meet those a page has already played.
 */
export function withFreshIds(
  file: ProjectFile,
  fresh: () => string
): ProjectFile {
  const ids = new Map(file.samples.map((sample) => [sample.id, fresh()]));
  return {
    ...file,
    doc: {
      ...file.doc,
      clips: file.doc.clips.map((clip) =>
        clip.recording && ids.has(clip.recording)
          ? { ...clip, recording: ids.get(clip.recording) }
          : clip
      ),
      // The drum racks' pads play recordings too.
      tracks: file.doc.tracks.map((track) =>
        renamePadRecordings(track, (id) => ids.get(id) ?? id)
      ),
    },
    samples: file.samples.map((sample) => ({
      ...sample,
      id: ids.get(sample.id) ?? sample.id,
    })),
  };
}
