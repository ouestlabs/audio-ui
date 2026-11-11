import { describe, expect, test } from "bun:test";
import writeMidi from "@audio/midi-write";
import { secondsPerBar, secondsPerQuarter } from "@audio-ui/engine/time";
import { DRUM_RACK_DEVICE, NEW_TRACK } from "@/lib/arrangement";
import { newProject } from "@/lib/daw/project";
import {
  isScoreFile,
  partInstrument,
  readScore,
  type Score,
  scoreCommands,
} from "@/lib/daw/scores";
import { libraryDevice } from "@/lib/device-library";

const doc = newProject();
const QUARTER = secondsPerQuarter(doc.tempo);
const BAR = secondsPerBar(doc.tempo);

const SCORE: Score = {
  name: "Song",
  parts: [
    {
      drums: false,
      name: "Bass",
      notes: [
        { length: 1, pitch: 36, start: 0, velocity: 0.8 },
        { length: 2, pitch: 43, start: 4, velocity: 0.8 },
      ],
      program: 33,
    },
    {
      drums: true,
      name: "Drums",
      notes: [{ length: 0.25, pitch: 36, start: 0, velocity: 1 }],
    },
  ],
};

const clipsOf = (commands: ReturnType<typeof scoreCommands>) =>
  commands.flatMap((command) =>
    command.type === "add-clip" ? [command.clip] : []
  );

describe("the instrument a part asks for", () => {
  test("drums get a drum rack; a program, its family's nearest; none, the starter's", () => {
    expect(partInstrument({ drums: true, name: "", notes: [] })).toBe(
      DRUM_RACK_DEVICE
    );
    expect(
      partInstrument({ drums: false, name: "", notes: [], program: 0 })
    ).toBe("audioui.electric-piano");
    expect(
      partInstrument({ drums: false, name: "", notes: [], program: 33 })
    ).toBe("audioui.mono-synth");
    expect(
      partInstrument({ drums: false, name: "", notes: [], program: 48 })
    ).toBe("audioui.string-machine");
    expect(partInstrument({ drums: false, name: "", notes: [] })).toBe(
      "audioui.pocket-synth"
    );
  });

  test("every program has an instrument of the library", () => {
    for (let program = 0; program < 128; program += 1) {
      const device = partInstrument({
        drums: false,
        name: "",
        notes: [],
        program,
      });
      expect(libraryDevice(device)?.device.kind).toBe("instrument");
    }
  });
});

describe("MID-008: scores laid on the arrangement", () => {
  test("on the add-track button, a MIDI track a part, with its instrument, its notes on the arrangement's grid from the start", () => {
    const commands = scoreCommands([SCORE], NEW_TRACK, 0, doc);
    const tracks = commands.flatMap((command) =>
      command.type === "add-track" ? [command] : []
    );
    expect(tracks.map(({ kind, name }) => [kind, name])).toEqual([
      ["midi", "Bass"],
      ["midi", "Drums"],
    ]);
    const devices = commands.flatMap((command) =>
      command.type === "add-device" ? [command] : []
    );
    expect(devices.map(({ device }) => device)).toEqual([
      "audioui.mono-synth",
      DRUM_RACK_DEVICE,
    ]);
    const ids = tracks.map(({ id }) => id ?? "");
    expect(devices.map(({ track }) => track)).toEqual(ids);
    const clips = clipsOf(commands);
    expect(clips.map((clip) => clip.track)).toEqual(ids);
    const [bass, drums] = clips;
    expect(
      bass?.notes?.map(({ length, pitch, start }) => [start, length, pitch])
    ).toEqual([
      [0, QUARTER, 36],
      [4 * QUARTER, 2 * QUARTER, 43],
    ]);
    // Six beats of notes: two bars.
    expect(bass?.value).toMatchObject({ length: 2 * BAR, offset: 0, start: 0 });
    expect(drums?.value.length).toBe(BAR);
  });

  test("a score of one part makes a track named after its file", () => {
    const [part] = SCORE.parts;
    const commands = scoreCommands(
      [{ name: "Riff", parts: part ? [part] : [] }],
      NEW_TRACK,
      0,
      doc
    );
    const [track] = commands.flatMap((command) =>
      command.type === "add-track" ? [command] : []
    );
    expect(track?.name).toBe("Riff");
  });

  test("on a MIDI track, a clip a score with every part's notes, one after the other from where they were dropped", () => {
    const midi = doc.tracks.find((track) => track.kind === "midi");
    const commands = scoreCommands(
      [SCORE, { ...SCORE, name: "Again" }],
      midi?.id ?? "",
      BAR,
      doc
    );
    expect(commands.some((command) => command.type === "add-track")).toBe(
      false
    );
    const clips = clipsOf(commands);
    expect(
      clips.map((clip) => [clip.name, clip.value.start, clip.notes?.length])
    ).toEqual([
      ["Song", BAR, 3],
      ["Again", 3 * BAR, 3],
    ]);
  });

  test("the arrangement grows to hold what goes past its end", () => {
    const [first] = scoreCommands([SCORE], NEW_TRACK, doc.duration, doc);
    expect(first).toEqual({
      duration: doc.duration + 2 * BAR,
      type: "set-duration",
    });
  });
});

describe("reading a score", () => {
  test("a MIDI file reads as its parts; a file that is not one reads as nothing", async () => {
    const midi = new File(
      [
        // A copy on an ArrayBuffer of its own, as a file part takes.
        new Uint8Array(
          writeMidi(
            [{ channel: 0, duration: 60 / 90, midi: 60, time: 0, velocity: 1 }],
            { bpm: 90 }
          )
        ),
      ],
      "Tune.mid",
      { type: "audio/midi" }
    );
    expect(isScoreFile(midi)).toBe(true);
    const read = await readScore(midi);
    expect(read?.name).toBe("Tune");
    expect(read?.parts[0]?.notes).toEqual([
      { length: 1, pitch: 60, start: 0, velocity: 1 },
    ]);
    const junk = new File(["not a score"], "notes.mid");
    expect(await readScore(junk)).toBeNull();
    expect(isScoreFile(new File([], "take.wav", { type: "audio/wav" }))).toBe(
      false
    );
  });
});
