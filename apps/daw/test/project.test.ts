import { describe, expect, test } from "bun:test";
import { newProject, START_TEMPO } from "@/lib/daw/project";

describe("ARR-009 tracks in a new project", () => {
  const doc = newProject();

  test("two MIDI tracks with a synth come first, then two audio tracks", () => {
    expect(doc.tracks.map((track) => [track.name, track.kind])).toEqual([
      ["1 MIDI", "midi"],
      ["2 MIDI", "midi"],
      ["3 Audio", "audio"],
      ["4 Audio", "audio"],
    ]);
    for (const track of doc.tracks.slice(0, 2)) {
      expect(track.devices?.some((device) => device.instrument)).toBe(true);
    }
  });

  test("a reverb return and a delay return follow, at 120 BPM in 4/4", () => {
    expect(doc.returns.map((track) => track.name)).toEqual([
      "A Reverb",
      "B Delay",
    ]);
    expect(START_TEMPO).toEqual({ beatUnit: 4, beatsPerBar: 4, bpm: 120 });
  });
});
