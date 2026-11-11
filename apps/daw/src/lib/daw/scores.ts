import type { Note } from "@audio-ui/core/piano-roll";
import { secondsPerBar, secondsPerQuarter } from "@audio-ui/engine/time";
import { DRUM_RACK_DEVICE, NEW_TRACK } from "@/lib/arrangement";
import {
  type ArrangementCommand,
  type ArrangementDoc,
  allTracks,
} from "@/lib/arrangement-state";
import { freshMidiClipId, nameOf } from "@/lib/daw/recordings";
import { libraryDevice } from "@/lib/device-library";
import { drumKit } from "@/lib/drum-kit";
import {
  MIDI_FILE_ACCEPT,
  readMidiFileParts,
  type ScorePart,
} from "@audio-ui/engine/files";
import {
  MUSICXML_FILE_ACCEPT,
  readMusicXmlFileParts,
} from "@audio-ui/engine/files";

/** What the import and a drop take as a score: a MIDI file, or a MusicXML score. */
export const SCORE_ACCEPT = `${MIDI_FILE_ACCEPT},${MUSICXML_FILE_ACCEPT}`;
const MIDI_NAME = /\.midi?$/i;
const MUSICXML_NAME = /\.(?:musicxml|mxl|xml)$/i;
const SCORE_TYPE = /midi|musicxml/;

/** The instrument a part with no program of its own gets: the one a new project's MIDI tracks have. */
const DEFAULT_INSTRUMENT = "audioui.pocket-synth";

/**
 * The library's instrument nearest each General MIDI family, the programs in
 * eights: pianos, chromatic percussion, organs, guitars, basses, strings,
 * ensembles, brass, reeds, pipes, synth leads, synth pads, synth effects,
 * ethnic, percussive and sound effects.
 */
const FAMILY_INSTRUMENTS = [
  "audioui.electric-piano",
  "audioui.fm-synth",
  "audioui.organ",
  "audioui.guitar",
  "audioui.mono-synth",
  "audioui.string-machine",
  "audioui.string-machine",
  "audioui.poly-synth",
  "audioui.poly-synth",
  "audioui.poly-synth",
  "audioui.mono-synth",
  "audioui.poly-synth",
  "audioui.poly-synth",
  "audioui.guitar",
  "audioui.fm-synth",
  "audioui.pocket-synth",
] as const;

/** Whether a file is a score rather than a sound: by its name, or its type. */
export function isScoreFile(file: File): boolean {
  return (
    MIDI_NAME.test(file.name) ||
    MUSICXML_NAME.test(file.name) ||
    SCORE_TYPE.test(file.type)
  );
}

/** A score read: named after its file, its parts in beats, each with notes. */
export interface Score {
  name: string;
  parts: ScorePart[];
}

/** A score file read as parts, a MIDI file or a MusicXML score by its name or type; null for one that cannot be read, or holds no note. */
export async function readScore(file: File): Promise<Score | null> {
  const midi = MIDI_NAME.test(file.name) || file.type.includes("midi");
  try {
    const read = midi
      ? await readMidiFileParts(file)
      : await readMusicXmlFileParts(file);
    const parts = read.parts.filter((part) => part.notes.length > 0);
    return parts.length > 0 ? { name: nameOf(file), parts } : null;
  } catch {
    return null;
  }
}

/** The library's instrument a part asks for: a drum rack for drums, the nearest of its program's family, or the default one. */
export function partInstrument(part: ScorePart): string {
  if (part.drums) {
    return DRUM_RACK_DEVICE;
  }
  return part.program === undefined
    ? DEFAULT_INSTRUMENT
    : (FAMILY_INSTRUMENTS[part.program >> 3] ?? DEFAULT_INSTRUMENT);
}

/** What puts a part's instrument on a track: a drum rack with its kit, or the instrument as it comes. */
function instrumentCommand(part: ScorePart, track: string): ArrangementCommand {
  const device = partInstrument(part);
  if (device === DRUM_RACK_DEVICE) {
    return {
      device,
      instrument: true,
      rack: drumKit(),
      state: {},
      track,
      type: "add-device",
    };
  }
  return {
    device,
    instrument: true,
    state: libraryDevice(device)?.device.defaults() ?? {},
    track,
    type: "add-device",
  };
}

/**
 * What lays scores out, as one batch (MID-008): on the add-track button, a
 * MIDI track for each part, named after it (after its file, when it is the
 * only one), with the instrument it asks for and its notes as a clip from
 * `at`; on a MIDI track, a clip for each score with every part's notes, one
 * after the other from `at`. A beat of a score is a quarter note at the
 * arrangement's tempo, so a clip lands on its grid; each lasts whole bars.
 * The arrangement grows to hold what goes past its end.
 */
export function scoreCommands(
  scores: readonly Score[],
  track: string,
  at: number,
  doc: ArrangementDoc
): ArrangementCommand[] {
  const quarter = secondsPerQuarter(doc.tempo);
  const bar = secondsPerBar(doc.tempo);
  const tracks = new Set(allTracks(doc).map((each) => each.id));
  const clips = new Set(doc.clips.map((clip) => clip.id));
  const commands: ArrangementCommand[] = [];
  let end = doc.duration;
  const freshTrack = () => {
    let count = 1;
    while (tracks.has(`track-${count}`)) {
      count += 1;
    }
    tracks.add(`track-${count}`);
    return `track-${count}`;
  };
  /** A clip of the parts' notes on `onto` from `from`; how long it is. */
  const lay = (
    onto: string,
    name: string,
    parts: readonly ScorePart[],
    from: number
  ) => {
    const notes: Note[] = parts
      .flatMap((part) => part.notes)
      .map((note, index) => ({
        id: index + 1,
        length: note.length * quarter,
        pitch: note.pitch,
        start: note.start * quarter,
        velocity: note.velocity,
      }));
    const last = Math.max(...notes.map((note) => note.start + note.length));
    // Whole bars, the last one only as far as the notes need.
    const length = Math.max(1, Math.ceil(last / bar - 1e-9)) * bar;
    const id = freshMidiClipId(clips);
    clips.add(id);
    commands.push({
      clip: {
        id,
        name,
        notes,
        sourceLength: length,
        track: onto,
        value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: from },
      },
      type: "add-clip",
    });
    end = Math.max(end, from + length);
    return length;
  };
  let next = at;
  for (const score of scores) {
    if (track !== NEW_TRACK) {
      next += lay(track, score.name, score.parts, next);
      continue;
    }
    for (const part of score.parts) {
      const id = freshTrack();
      const name = score.parts.length === 1 ? score.name : part.name;
      commands.push({ id, kind: "midi", name, type: "add-track" });
      commands.push(instrumentCommand(part, id));
      lay(id, name, [part], at);
    }
  }
  return end > doc.duration
    ? [{ duration: end, type: "set-duration" }, ...commands]
    : commands;
}
