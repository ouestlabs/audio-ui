import { describe, expect, test } from "bun:test";
import { act, fireEvent } from "@testing-library/react";
import { drag, lastCall, notesById, renderRoll } from "../helpers.js";

// Note a: C4 (row 3, y 30-40), 0 to 2 (x 0-20). Note b: D4 (row 1), 4 to 8.

describe("PianoRoll.Note", () => {
  test("is a toggle button named after its pitch and span", () => {
    const { note } = renderRoll();
    expect(note("a").getAttribute("role")).toBe("button");
    expect(note("a").getAttribute("aria-label")).toBe("C4, 0 to 2");
    expect(note("a").getAttribute("aria-pressed")).toBe("false");
    expect(note("a").tabIndex).toBe(0);
  });

  test("selects only itself when pressed, and toggles with Shift", () => {
    const { note, onSelectionChange } = renderRoll({ defaultSelection: ["b"] });
    fireEvent.pointerDown(note("a"), {
      button: 0,
      clientX: 5,
      clientY: 35,
      pointerId: 1,
    });
    fireEvent.pointerUp(note("a"), { clientX: 5, clientY: 35, pointerId: 1 });
    expect(lastCall(onSelectionChange)).toMatchObject([
      ["a"],
      { reason: "press" },
    ]);
    fireEvent.pointerDown(note("b"), {
      button: 0,
      clientX: 45,
      clientY: 15,
      pointerId: 1,
      shiftKey: true,
    });
    expect(lastCall(onSelectionChange)[0]).toEqual(["a", "b"]);
  });

  test("moves on the grid, across and between rows", () => {
    const { note, onValueCommitted } = renderRoll();
    drag(note("a"), [5, 35], [37, 25]);
    const [value, details] = lastCall(onValueCommitted);
    expect(notesById(value).a).toMatchObject({ pitch: 61, start: 3 });
    expect(details).toMatchObject({ edit: "move", reason: "drag" });
  });

  test("moves off the grid with Cmd/Ctrl", () => {
    const { note, onValueCommitted } = renderRoll();
    drag(note("a"), [5, 35], [37, 35], { metaKey: true });
    expect(notesById(lastCall(onValueCommitted)[0]).a?.start).toBeCloseTo(3.2);
  });

  test("moves the whole selection when part of it", () => {
    const { note, onValueCommitted } = renderRoll({
      defaultSelection: ["a", "b"],
    });
    drag(note("a"), [5, 35], [25, 35]);
    const moved = notesById(lastCall(onValueCommitted)[0]);
    expect(moved.a?.start).toBe(2);
    expect(moved.b?.start).toBe(6);
  });

  test("carries copies off with Alt, leaving the notes where they were", () => {
    const { note, onSelectionChange, onValueCommitted } = renderRoll();
    drag(note("b"), [45, 15], [75, 15], { altKey: true });
    const [value, details] = lastCall(onValueCommitted);
    expect(details.edit).toBe("duplicate");
    expect(value).toHaveLength(3);
    expect(notesById(value).b?.start).toBe(4);
    const copy = value.at(-1);
    expect(copy).toMatchObject({ length: 4, pitch: 62, start: 7 });
    expect(lastCall(onSelectionChange)[0]).toEqual([copy?.id ?? ""]);
    expect(document.activeElement).toBe(note(String(copy?.id)));
  });

  test("treats a press that barely moves as a click", () => {
    const { note, onValueChange, onValueCommitted } = renderRoll();
    drag(note("a"), [5, 35], [7, 36]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
  });

  test("sounds while held, following its pitch", () => {
    const { note, onNoteOff, onNoteOn } = renderRoll();
    fireEvent.pointerDown(note("a"), {
      button: 0,
      clientX: 5,
      clientY: 35,
      pointerId: 1,
    });
    expect(lastCall(onNoteOn)).toMatchObject([
      60,
      { reason: "drag", velocity: 1 },
    ]);
    fireEvent.pointerMove(note("a"), { clientX: 5, clientY: 15, pointerId: 1 });
    expect(lastCall(onNoteOff)[0]).toBe(60);
    expect(lastCall(onNoteOn)[0]).toBe(62);
    fireEvent.pointerUp(note("a"), { clientX: 5, clientY: 15, pointerId: 1 });
    expect(lastCall(onNoteOff)[0]).toBe(62);
  });

  test("removes only itself on double-click", () => {
    const { note, onValueCommitted } = renderRoll({
      defaultSelection: ["a", "b"],
    });
    fireEvent.doubleClick(note("a"));
    const [value, details] = lastCall(onValueCommitted);
    expect(value.map((other) => other.id)).toEqual(["b"]);
    expect(details).toMatchObject({ edit: "remove", reason: "double-click" });
  });

  test("moves with the arrow keys and resizes with Shift + Left/Right", () => {
    const { note, onValueCommitted } = renderRoll();
    fireEvent.keyDown(note("a"), { key: "ArrowRight" });
    expect(notesById(lastCall(onValueCommitted)[0]).a?.start).toBe(1);
    expect(lastCall(onValueCommitted)[1]).toMatchObject({
      edit: "move",
      reason: "keyboard",
    });
    fireEvent.keyDown(note("a"), { key: "ArrowRight", shiftKey: true });
    expect(notesById(lastCall(onValueCommitted)[0]).a?.length).toBe(3);
  });

  test("moves by a semitone, an octave with Shift, sounding the new pitch", () => {
    const { note, onNoteOff, onNoteOn, onValueCommitted } = renderRoll();
    fireEvent.keyDown(note("a"), { key: "ArrowUp" });
    expect(notesById(lastCall(onValueCommitted)[0]).a?.pitch).toBe(61);
    expect(lastCall(onNoteOn)).toMatchObject([61, { reason: "keyboard" }]);
    fireEvent.keyUp(note("a"), { key: "ArrowUp" });
    expect(lastCall(onNoteOff)[0]).toBe(61);
    fireEvent.keyDown(note("a"), { key: "ArrowUp", shiftKey: true });
    // An octave would leave the roll: the note stops at its top.
    expect(notesById(lastCall(onValueCommitted)[0]).a?.pitch).toBe(63);
  });

  test("toggles its selection with Enter or Space", () => {
    const { note, onSelectionChange } = renderRoll();
    fireEvent.keyDown(note("b"), { key: "Enter" });
    expect(lastCall(onSelectionChange)).toMatchObject([
      ["b"],
      { reason: "keyboard" },
    ]);
    fireEvent.keyDown(note("b"), { key: " " });
    expect(lastCall(onSelectionChange)[0]).toEqual([]);
  });

  test("removes the selection with Delete and focuses the next note", () => {
    const { grid, note, onValueCommitted } = renderRoll();
    act(() => note("a").focus());
    fireEvent.keyDown(note("a"), { key: "Delete" });
    expect(lastCall(onValueCommitted)[0].map((other) => other.id)).toEqual([
      "b",
    ]);
    expect(document.activeElement).toBe(note("b"));
    fireEvent.keyDown(note("b"), { key: "Backspace" });
    expect(document.activeElement).toBe(grid);
  });
});

describe("PianoRoll.NoteHandle", () => {
  test("lengthens the note from its end, on the grid", () => {
    const { onValueCommitted, view } = renderRoll();
    drag(view.getByTestId("end-a"), [19, 35], [41, 35]);
    const [value, details] = lastCall(onValueCommitted);
    expect(notesById(value).a).toMatchObject({ length: 4, start: 0 });
    expect(details).toMatchObject({ edit: "resize", reason: "drag" });
  });

  test("trims the note from its start, keeping its end", () => {
    const { onValueCommitted, view } = renderRoll();
    drag(view.getByTestId("start-b"), [41, 15], [61, 15]);
    expect(notesById(lastCall(onValueCommitted)[0]).b).toMatchObject({
      length: 2,
      start: 6,
    });
  });

  test("is hidden from assistive technology", () => {
    const { view } = renderRoll();
    expect(view.getByTestId("end-a").getAttribute("aria-hidden")).toBe("true");
    expect(view.getByTestId("end-a").getAttribute("data-edge")).toBe("end");
  });
});
