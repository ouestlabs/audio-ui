import { describe, expect, test } from "bun:test";
import { noteSelectionReadout } from "@/registry-audio/bases/base/audio/panels/midi-clip-panel";

/** A bar of 2 s in 4/4: a beat is half a second. */
const meter = { bar: 2, beatsPerBar: 4 };

describe("noteSelectionReadout", () => {
  test("reads out the notes held: pitches, where they start, how long they last and how hard they play", () => {
    const readout = noteSelectionReadout(
      [
        { id: "a", length: 0.25, pitch: 60, start: 0.5, velocity: 1 },
        { id: "b", length: 0.5, pitch: 67, start: 1, velocity: 0.5 },
      ],
      meter
    );
    expect(readout).toEqual([
      { label: "Pitch", value: "C4–G4" },
      { label: "Start", value: "1.2.1" },
      { label: "Length", value: "0.2.0" },
      { label: "Velocity", value: "64–127" },
    ]);
  });

  test("one value where they agree, not a range", () => {
    const [pitch, , , velocity] = noteSelectionReadout(
      [
        { id: "a", length: 0.5, pitch: 62, start: 0, velocity: 0.8 },
        { id: "b", length: 0.5, pitch: 62, start: 1, velocity: 0.8 },
      ],
      meter
    );
    expect(pitch?.value).toBe("D4");
    expect(velocity?.value).toBe("102");
  });
});
