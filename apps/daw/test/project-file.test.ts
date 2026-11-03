import { describe, expect, test } from "bun:test";
import { newProject } from "@/lib/daw/project";
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  readProjectFile,
  sampleFileName,
  sniffExtension,
  withFreshIds,
  writeProjectFile,
} from "@/lib/daw/project-file";

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
});
