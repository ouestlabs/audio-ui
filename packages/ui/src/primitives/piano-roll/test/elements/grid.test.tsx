import { describe, expect, test } from "bun:test";
import { act, fireEvent } from "@testing-library/react";
import { drag, lastCall, notesById, renderRoll } from "../helpers";

describe("PianoRoll.Grid", () => {
  test("is a focusable group placed as a timeline lane", () => {
    const { grid } = renderRoll();
    expect(grid.getAttribute("role")).toBe("group");
    expect(grid.tabIndex).toBe(0);
    expect(grid.style.getPropertyValue("--timeline-unit")).toBe(
      "calc(100% / 16)"
    );
  });

  test("selects the notes a rectangle drawn across empty grid touches", () => {
    const { grid, onSelectionChange, view } = renderRoll({
      defaultSelection: ["a"],
    });
    fireEvent.pointerDown(grid, {
      button: 0,
      clientX: 30,
      clientY: 5,
      pointerId: 1,
    });
    expect(lastCall(onSelectionChange)[0]).toEqual([]);
    fireEvent.pointerMove(grid, { clientX: 45, clientY: 15, pointerId: 1 });
    expect(lastCall(onSelectionChange)).toMatchObject([
      ["b"],
      { reason: "marquee" },
    ]);
    const marquee = view.getByTestId("marquee");
    expect(marquee.style.left).toBe("30px");
    expect(marquee.style.width).toBe("15px");
    expect(marquee.style.height).toBe("10px");
    fireEvent.pointerUp(grid, { clientX: 45, clientY: 15, pointerId: 1 });
    expect(view.queryByTestId("marquee")).toBeNull();
  });

  test("adds what the rectangle touches to the selection with Shift", () => {
    const { grid, onSelectionChange } = renderRoll({ defaultSelection: ["a"] });
    drag(grid, [30, 5], [45, 15], { shiftKey: true });
    expect(lastCall(onSelectionChange)[0]).toEqual(["a", "b"]);
  });

  test("draws a note in the cell double-clicked", () => {
    const { grid, onValueCommitted } = renderRoll();
    fireEvent.doubleClick(grid, { clientX: 125, clientY: 25 });
    const [value, details] = lastCall(onValueCommitted);
    expect(value.at(-1)).toMatchObject({ length: 1, pitch: 61, start: 12 });
    expect(details).toMatchObject({ edit: "add", reason: "double-click" });
  });

  test("draws on press in draw mode, the end following the pointer", () => {
    const { grid, onNoteOff, onNoteOn, onValueCommitted } = renderRoll({
      mode: "draw",
    });
    drag(grid, [125, 25], [158, 25]);
    const [value, details] = lastCall(onValueCommitted);
    expect(value.at(-1)).toMatchObject({ length: 4, pitch: 61, start: 12 });
    expect(details).toMatchObject({ edit: "add", reason: "draw" });
    expect(lastCall(onNoteOn)).toMatchObject([61, { reason: "draw" }]);
    expect(lastCall(onNoteOff)).toMatchObject([61, { reason: "draw" }]);
  });

  test("gives the next note drawn the length last drawn", () => {
    const { grid, onValueCommitted } = renderRoll({ mode: "draw" });
    drag(grid, [101, 5], [131, 5]);
    fireEvent.pointerDown(grid, {
      button: 0,
      clientX: 51,
      clientY: 15,
      pointerId: 2,
    });
    fireEvent.pointerUp(grid, { clientX: 51, clientY: 15, pointerId: 2 });
    expect(lastCall(onValueCommitted)[0].at(-1)).toMatchObject({
      length: 3,
      pitch: 62,
      start: 5,
    });
  });

  test("adds a note at the playback position with Enter and focuses it", () => {
    const { grid, onValueCommitted, view } = renderRoll(
      {},
      { defaultPosition: 9.5 }
    );
    act(() => grid.focus());
    fireEvent.keyDown(grid, { key: "Enter" });
    const added = lastCall(onValueCommitted)[0].at(-1);
    // No pitch auditioned yet: the middle row.
    expect(added).toMatchObject({ pitch: 61, start: 9 });
    expect(document.activeElement).toBe(view.getByTestId(`note-${added?.id}`));
  });

  test("clears the selection with Escape and selects everything with Cmd/Ctrl+A", () => {
    const { grid, onSelectionChange } = renderRoll({ defaultSelection: ["a"] });
    fireEvent.keyDown(grid, { key: "Escape" });
    expect(lastCall(onSelectionChange)[0]).toEqual([]);
    fireEvent.keyDown(grid, { ctrlKey: true, key: "a" });
    expect(lastCall(onSelectionChange)[0]).toEqual(["a", "b"]);
  });

  test("does nothing when disabled", () => {
    const { grid, onValueChange } = renderRoll({
      disabled: true,
      mode: "draw",
    });
    drag(grid, [125, 25], [158, 25]);
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(grid.tabIndex).toBe(-1);
  });

  test("leaves the other notes where they are while drawing", () => {
    const { grid, onValueCommitted } = renderRoll({ mode: "draw" });
    drag(grid, [125, 25], [126, 25]);
    expect(notesById(lastCall(onValueCommitted)[0]).a).toMatchObject({
      start: 0,
    });
  });
});
