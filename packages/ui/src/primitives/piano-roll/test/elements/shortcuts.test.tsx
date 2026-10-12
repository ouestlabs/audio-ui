import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { lastCall, renderRoll } from "../helpers.tsx";

// Note a: C4, 0 to 2. Note b: D4, 4 to 8. The timeline is 16 long, grid every unit.

const mod = { ctrlKey: true };

describe("PianoRoll shortcuts", () => {
  test("Cmd/Ctrl+D copies the selection right after it and selects the copies", () => {
    const { note, onSelectionChange, onValueCommitted } = renderRoll({
      defaultSelection: ["a"],
    });
    fireEvent.keyDown(note("a"), { key: "d", ...mod });
    const [notes, details] = lastCall(onValueCommitted);
    expect(details).toMatchObject({ edit: "duplicate", reason: "keyboard" });
    expect(notes).toHaveLength(3);
    expect(notes[2]).toMatchObject({ length: 2, pitch: 60, start: 2 });
    expect(lastCall(onSelectionChange)[0]).toHaveLength(1);
    expect(lastCall(onSelectionChange)[0][0]).toBe(notes[2]?.id as string);
  });

  test("Q snaps the starts of the selection to the grid", () => {
    const { note, onValueCommitted } = renderRoll({
      defaultSelection: ["b"],
      defaultValue: [
        { id: "a", length: 2, pitch: 60, start: 0.3 },
        { id: "b", length: 2, pitch: 62, start: 4.4 },
      ],
    });
    fireEvent.keyDown(note("b"), { key: "q" });
    const [notes, details] = lastCall(onValueCommitted);
    expect(details).toMatchObject({ edit: "quantize" });
    expect(notes.map((n) => n.start)).toEqual([0.3, 4]);
  });

  test("Q with nothing selected snaps every note", () => {
    const { grid, onValueCommitted } = renderRoll({
      defaultValue: [
        { id: "a", length: 2, pitch: 60, start: 0.3 },
        { id: "b", length: 2, pitch: 62, start: 4.4 },
      ],
    });
    fireEvent.keyDown(grid, { key: "q" });
    expect(lastCall(onValueCommitted)[0].map((n) => n.start)).toEqual([0, 4]);
  });

  test("copy, then paste at the playback position", () => {
    const { grid, note, onValueCommitted } = renderRoll(
      { defaultSelection: ["b"] },
      { defaultPosition: 10.4 }
    );
    fireEvent.keyDown(note("b"), { key: "c", ...mod });
    fireEvent.keyDown(grid, { key: "v", ...mod });
    const [notes, details] = lastCall(onValueCommitted);
    expect(details).toMatchObject({ edit: "paste" });
    expect(notes).toHaveLength(3);
    expect(notes[2]).toMatchObject({ length: 4, pitch: 62, start: 10 });
  });

  test("cut removes the selection and a paste brings it back", () => {
    const { grid, note, onValueCommitted } = renderRoll({
      defaultSelection: ["a"],
    });
    fireEvent.keyDown(note("a"), { key: "x", ...mod });
    expect(lastCall(onValueCommitted)[0].map((n) => n.id)).toEqual(["b"]);
    fireEvent.keyDown(grid, { key: "v", ...mod });
    expect(lastCall(onValueCommitted)[0]).toHaveLength(2);
  });

  test("ignores Alt and keys that are not commands", () => {
    const { note, onValueCommitted } = renderRoll({ defaultSelection: ["a"] });
    fireEvent.keyDown(note("a"), { altKey: true, key: "d", ...mod });
    fireEvent.keyDown(note("a"), { key: "d" });
    fireEvent.keyDown(note("a"), { key: "z", ...mod });
    expect(onValueCommitted).not.toHaveBeenCalled();
  });
});
