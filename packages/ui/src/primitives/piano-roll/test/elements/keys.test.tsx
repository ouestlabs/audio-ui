import { describe, expect, test } from "bun:test";
import { fireEvent } from "@testing-library/react";
import { lastCall, renderRoll } from "../helpers.js";

// The keys are 40px tall, four rows of 10px: C4 at the bottom.
const C4 = { clientX: 20, clientY: 35 };
const D4 = { clientX: 20, clientY: 15 };

const KEY_NAME = /^[A-G]#?4$/;

describe("PianoRoll.Keys", () => {
  test("is a vertical keyboard of the roll's rows", () => {
    const { keys, view } = renderRoll();
    expect(keys.getAttribute("role")).toBe("group");
    expect(keys.getAttribute("data-orientation")).toBe("vertical");
    expect(
      view
        .getAllByRole("button", { name: KEY_NAME })
        .map((key) => key.getAttribute("aria-label"))
    ).toEqual(["D#4", "D4", "C#4", "C4"]);
    expect(view.getByTestId("key-60").style.bottom).toBe("0%");
    expect(view.getByTestId("key-60").style.height).toBe("25%");
  });

  test("sounds a pressed key through the roll, lighting its row", () => {
    const { keys, onNoteOff, onNoteOn, view } = renderRoll();
    fireEvent.pointerDown(keys, { ...C4, button: 0, pointerId: 1 });
    expect(lastCall(onNoteOn)).toMatchObject([
      60,
      { reason: "press", velocity: 1 },
    ]);
    expect(view.getByTestId("row-60").hasAttribute("data-active")).toBe(true);
    expect(view.getByTestId("key-60").hasAttribute("data-active")).toBe(true);
    fireEvent.pointerUp(keys, { ...C4, pointerId: 1 });
    expect(lastCall(onNoteOff)[0]).toBe(60);
    expect(view.getByTestId("row-60").hasAttribute("data-active")).toBe(false);
  });

  test("selects every note on a row with Shift, and gives them back", () => {
    const { keys, onNoteOn, onSelectionChange } = renderRoll();
    fireEvent.pointerDown(keys, {
      ...D4,
      button: 0,
      pointerId: 1,
      shiftKey: true,
    });
    fireEvent.pointerUp(keys, { ...D4, pointerId: 1 });
    expect(onNoteOn).not.toHaveBeenCalled();
    expect(lastCall(onSelectionChange)).toMatchObject([
      ["b"],
      { reason: "press" },
    ]);
    fireEvent.pointerDown(keys, {
      ...D4,
      button: 0,
      pointerId: 1,
      shiftKey: true,
    });
    expect(lastCall(onSelectionChange)[0]).toEqual([]);
  });

  test("selects a row with Shift + Enter", () => {
    const { onSelectionChange, view } = renderRoll();
    fireEvent.keyDown(view.getByTestId("key-60"), {
      key: "Enter",
      shiftKey: true,
    });
    expect(lastCall(onSelectionChange)).toMatchObject([
      ["a"],
      { reason: "keyboard" },
    ]);
  });

  test("shows only the rows a folded roll draws", () => {
    const { view } = renderRoll({ folded: true });
    expect(view.queryByTestId("key-61")).toBeNull();
    expect(view.getByTestId("key-62").style.height).toBe("50%");
  });
});

describe("PianoRoll.Row", () => {
  test("bands a pitch across the grid, letting presses through", () => {
    const { view } = renderRoll();
    const row = view.getByTestId("row-61");
    expect(row.getAttribute("data-color")).toBe("black");
    expect(row.getAttribute("aria-hidden")).toBe("true");
    expect(row.style.pointerEvents).toBe("none");
    expect(row.style.getPropertyValue("--piano-roll-row")).toBe("2");
    expect(view.getByTestId("row-60").hasAttribute("data-octave")).toBe(true);
  });
});
