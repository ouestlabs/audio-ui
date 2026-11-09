import { describe, expect, test } from "bun:test";
import { DRUM_RACK_DEVICE, padRecordings } from "@/lib/arrangement";
import { newProject, withUniqueTrackIds } from "@/lib/daw/project";
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  readProjectFile,
  sampleFileName,
  savedAs,
  sniffExtension,
  withFreshIds,
  writeProjectFile,
} from "@/lib/daw/project-file";
import { peakCountFor } from "@/lib/daw/recordings";

const bytes = (text: string, extra: number[] = []) =>
  new Uint8Array([...text].map((char) => char.charCodeAt(0)).concat(extra))
    .buffer;

describe("the project file", () => {
  test("PRJ-006: a document comes back as it was written, with its format and version on top", () => {
    const doc = newProject();
    const samples = [{ id: "rec-a", name: "Kick", path: "Samples/Kick.wav" }];
    const text = writeProjectFile(doc, samples);
    expect(Object.keys(JSON.parse(text)).slice(0, 2).sort()).toEqual([
      "doc",
      "format",
    ]);
    expect(readProjectFile(text)).toEqual({
      doc,
      format: PROJECT_FORMAT,
      samples,
      version: PROJECT_VERSION,
    });
  });

  test("PRJ-006: a file of another kind, of another version or not JSON is refused, saying why", () => {
    expect(() => readProjectFile("{")).toThrow("not JSON");
    expect(() => readProjectFile(JSON.stringify({ format: "other" }))).toThrow(
      "not an audio/ui project"
    );
    expect(() =>
      readProjectFile(JSON.stringify({ format: PROJECT_FORMAT, version: 2 }))
    ).toThrow("another version (2)");
    expect(() =>
      readProjectFile(
        JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION })
      )
    ).toThrow("incomplete");
  });

  test("PRJ-006: a sample is named after its recording, with the extension its bytes say", () => {
    expect(sniffExtension(bytes("RIFF\0\0\0\0WAVE"))).toBe("wav");
    expect(sniffExtension(bytes("fLaC"))).toBe("flac");
    expect(sniffExtension(bytes("ID3"))).toBe("mp3");
    expect(sniffExtension(bytes("", [0xff, 0xfb]))).toBe("mp3");
    expect(sniffExtension(bytes("\0\0\0 ftypM4A "))).toBe("m4a");
    expect(sniffExtension(bytes("????"))).toBe("audio");
    const taken = new Set(["Kick.wav", "Kick 2.wav"]);
    expect(sampleFileName("Kick", "wav", taken)).toBe("Kick 3.wav");
    expect(sampleFileName("Snare", "wav", taken)).toBe("Snare.wav");
  });

  test("PRJ-007: opened, its recordings take new ids, in the samples and in the clips that play them", () => {
    const doc = {
      ...newProject(),
      clips: [
        {
          id: "clip-1",
          name: "Kick",
          recording: "rec-old",
          sourceLength: 1,
          track: "track-1",
          value: { fadeIn: 0, fadeOut: 0, length: 1, offset: 0, start: 0 },
        },
      ],
    };
    const file = readProjectFile(
      writeProjectFile(doc, [
        { id: "rec-old", name: "Kick", path: "Samples/Kick.wav" },
      ])
    );
    const fresh = withFreshIds(file, () => "rec-new");
    expect(fresh.samples[0]?.id).toBe("rec-new");
    expect(fresh.doc.clips[0]?.recording).toBe("rec-new");
    expect(file.doc.clips[0]?.recording).toBe("rec-old");
  });

  test("PRJ-007 and DEV-013: the recordings a drum rack's pads play take their new ids too", () => {
    const project = newProject();
    const doc = {
      ...project,
      tracks: project.tracks.map((track, index) =>
        index === 0
          ? {
              ...track,
              devices: [
                {
                  device: DRUM_RACK_DEVICE,
                  id: "drums",
                  instrument: true,
                  rack: {
                    chains: [
                      {
                        devices: [],
                        id: "pad",
                        name: "Clap",
                        pad: {
                          note: 39,
                          sound: {
                            decay: 1,
                            kind: "sample" as const,
                            recording: "rec-old",
                            tune: 0,
                          },
                        },
                      },
                    ],
                    macros: [],
                  },
                  state: {},
                },
              ],
            }
          : track
      ),
    };
    const file = readProjectFile(
      writeProjectFile(doc, [
        { id: "rec-old", name: "Clap", path: "Samples/Clap.wav" },
      ])
    );
    const fresh = withFreshIds(file, () => "rec-new");
    expect([...padRecordings(fresh.doc.tracks)]).toEqual(["rec-new"]);
  });

  test("ARR-022: a project saved with two tracks under one id comes back with one id per track", () => {
    const doc = newProject();
    const [first, second] = doc.tracks;
    if (!(first && second)) {
      throw new Error("a new project has tracks");
    }
    const twice = {
      ...doc,
      clips: [
        {
          id: "clip",
          name: "Clip",
          sourceLength: 1,
          track: first.id,
          value: { fadeIn: 0, fadeOut: 0, length: 1, offset: 0, start: 0 },
        },
      ],
      tracks: [first, { ...second, id: first.id }],
    };
    const healed = withUniqueTrackIds(twice);
    const ids = healed.tracks.map((track) => track.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe(first.id);
    expect(healed.clips[0]?.track).toBe(first.id);
    expect(withUniqueTrackIds(doc)).toBe(doc);
  });
});

describe("peaks", () => {
  test("CLP-020: a recording keeps enough peaks for the closest zoom, however long it is", () => {
    // The closest zoom is 240 px a second.
    expect(peakCountFor(240) / 240).toBeGreaterThanOrEqual(240);
    expect(peakCountFor(1)).toBe(4096);
    expect(peakCountFor(36_000)).toBe(2 ** 20);
  });
});

describe("a recording saved again", () => {
  test("PRJ-007: is looked for under its own name, numbered or not, and nowhere else", () => {
    const files = [
      "Drums Verse.wav",
      "Drums Verse 2.wav",
      "Drums Verse Fill.wav",
      "Drums Chorus.wav",
      "Drums Verse 3.mp3",
    ];
    expect(savedAs("Drums Verse", "wav", files)).toEqual([
      "Drums Verse.wav",
      "Drums Verse 2.wav",
    ]);
    expect(savedAs("Bass (DI)", "wav", ["Bass (DI) 2.wav"])).toEqual([
      "Bass (DI) 2.wav",
    ]);
  });
});
