import { describe, expect, test } from "bun:test";
import { dropCommands, NEW_TRACK } from "@/lib/daw/drop";
import type { Recording } from "@/lib/daw/recordings";

const recording = (name: string, length: number): Recording => ({
  length,
  name,
  peaks: { max: new Float32Array(0), min: new Float32Array(0) },
  source: { channels: [], sampleRate: 48_000 },
});

const TEMPO = { beatsPerBar: 4, bpm: 120 };

const two = new Map([
  ["rec-1", recording("Kick", 2)],
  ["rec-2", recording("Snare", 3)],
]);

describe("dropping files", () => {
  test("ARR-005: on a track, one clip after the other from where they were dropped", () => {
    const commands = dropCommands(two, "track-1", 4, 100, TEMPO);
    expect(commands.map((command) => command.type)).toEqual([
      "add-clip",
      "add-clip",
    ]);
    const clips = commands.flatMap((command) =>
      command.type === "add-clip" ? [command.clip] : []
    );
    expect(
      clips.map((clip) => [
        clip.track,
        clip.value.start,
        clip.value.length,
        clip.recording,
      ])
    ).toEqual([
      ["track-1", 4, 2, "rec-1"],
      ["track-1", 6, 3, "rec-2"],
    ]);
  });

  test("ARR-006: on the add-track button, a track each, named after its file, every clip where they were dropped", () => {
    const commands = dropCommands(two, NEW_TRACK, 4, 100, TEMPO);
    expect(commands.map((command) => command.type)).toEqual([
      "add-track",
      "add-clip",
      "add-track",
      "add-clip",
    ]);
    const names = commands.flatMap((command) =>
      command.type === "add-track" ? [command.name] : []
    );
    expect(names).toEqual(["Kick", "Snare"]);
    const clips = commands.flatMap((command) =>
      command.type === "add-clip" ? [command.clip] : []
    );
    expect(clips.map((clip) => [clip.track, clip.value.start])).toEqual([
      ["track-rec-1", 4],
      ["track-rec-2", 4],
    ]);
  });

  test("TRN-008: the arrangement grows to hold what was dropped past its end", () => {
    const commands = dropCommands(two, "track-1", 97, 100, TEMPO);
    expect(commands[0]).toEqual({ duration: 102, type: "set-duration" });
  });

  test("CLP-019: a recording with a beat is laid down warped in time, in Beats", () => {
    // Two bars at 100 BPM, read as that loop: at 120 BPM they last two bars of 2 s.
    const loop: Recording = {
      ...recording("Loop", 4.8),
      beat: {
        estimate: { bpm: 100, confidence: 0.8, firstBeat: 0 },
        transients: [0],
      },
    };
    const commands = dropCommands(
      new Map([
        ["rec-3", loop],
        ["rec-1", recording("Kick", 2)],
      ]),
      "track-1",
      0,
      100,
      TEMPO
    );
    const [warped, after] = commands.flatMap((command) =>
      command.type === "add-clip" ? [command.clip] : []
    );
    expect(warped?.warpMode).toBe("beats");
    expect(warped?.value.length).toBeCloseTo(4, 9);
    expect(after?.value.start).toBeCloseTo(4, 9);
    expect(after?.warp).toBeUndefined();
  });
});
