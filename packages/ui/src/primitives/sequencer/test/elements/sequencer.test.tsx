import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import { act, fireEvent, render } from "@testing-library/react";
import { Sequencer } from "../../../../entries/sequencer";
import { lastCall, renderSequencer } from "../helpers";

const ROW_NAME = /^Row/;
const press = (cell: Element, x: number, y: number) =>
  fireEvent.pointerDown(cell, {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
  });

describe("Sequencer", () => {
  test("is a group of rows of toggle buttons", () => {
    const { cell, root, view } = renderSequencer();
    expect(root.getAttribute("role")).toBe("group");
    expect(view.getAllByRole("group", { name: ROW_NAME })).toHaveLength(2);
    expect(cell(0, 0).getAttribute("aria-pressed")).toBe("true");
    expect(cell(0, 1).getAttribute("aria-pressed")).toBe("false");
    expect(cell(0, 0).tagName).toBe("BUTTON");
  });

  test("has one tab stop, on the first cell", () => {
    const { view } = renderSequencer();
    const stops = view.getAllByRole("button").filter((c) => c.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]?.getAttribute("aria-label")).toBe("Row 1, step 1");
  });

  test("flips a cell on a press", () => {
    const { cell, onValueChange, onValueCommitted } = renderSequencer();
    press(cell(0, 1), 12, 3);
    fireEvent.pointerUp(cell(0, 1), { clientX: 12, clientY: 3, pointerId: 1 });
    expect(lastCall(onValueChange)[0][0]).toEqual([true, true, false, false]);
    expect(lastCall(onValueChange)[1].reason).toBe("press");
    expect(lastCall(onValueCommitted)[1].reason).toBe("paint");
    expect(cell(0, 1).getAttribute("aria-pressed")).toBe("true");
  });

  test("paints the new state across the cells the pointer crosses", () => {
    const { cell, onValueChange, root } = renderSequencer();
    press(cell(0, 1), 12, 3);
    fireEvent.pointerMove(root, { clientX: 22, clientY: 3, pointerId: 1 });
    fireEvent.pointerMove(root, { clientX: 32, clientY: 3, pointerId: 1 });
    fireEvent.pointerUp(root, { clientX: 32, clientY: 3, pointerId: 1 });
    expect(lastCall(onValueChange)[0][0]).toEqual([true, true, true, true]);
    expect(lastCall(onValueChange)[1].reason).toBe("paint");
  });

  test("paints off when it began on a cell that was on", () => {
    const { cell, onValueChange, root } = renderSequencer();
    press(cell(1, 2), 22, 13);
    fireEvent.pointerMove(root, { clientX: 12, clientY: 3, pointerId: 1 });
    fireEvent.pointerMove(root, { clientX: 2, clientY: 3, pointerId: 1 });
    fireEvent.pointerUp(root, { clientX: 2, clientY: 3, pointerId: 1 });
    // The press began on an on cell, so everything it crosses is painted off.
    expect(lastCall(onValueChange)[0]).toEqual([
      [false, false, false, false],
      [false, false, false, false],
    ]);
  });

  test("commits once when the gesture ends, and not when nothing changed", () => {
    const { cell, onValueCommitted, root } = renderSequencer({
      disabled: false,
    });
    press(cell(0, 0), 2, 3);
    fireEvent.pointerMove(root, { clientX: 2, clientY: 3, pointerId: 1 });
    fireEvent.pointerUp(root, { clientX: 2, clientY: 3, pointerId: 1 });
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  test("a cancelled change leaves the pattern as it was", () => {
    const { cell } = renderSequencer({
      onValueChange: (_value, details) => details.cancel(),
    });
    press(cell(0, 1), 12, 3);
    expect(cell(0, 1).getAttribute("aria-pressed")).toBe("false");
  });

  test("flips the focused cell with Space or Enter", () => {
    const { cell, onValueCommitted } = renderSequencer();
    fireEvent.keyDown(cell(0, 0), { key: " " });
    expect(cell(0, 0).getAttribute("aria-pressed")).toBe("false");
    expect(lastCall(onValueCommitted)[1].reason).toBe("keyboard");
    fireEvent.keyDown(cell(0, 0), { key: "Enter" });
    expect(cell(0, 0).getAttribute("aria-pressed")).toBe("true");
  });

  test("moves between cells with the arrow keys, keeping one tab stop", () => {
    const { cell } = renderSequencer();
    fireEvent.keyDown(cell(0, 0), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell(0, 1));
    expect(cell(0, 1).tabIndex).toBe(0);
    expect(cell(0, 0).tabIndex).toBe(-1);
    fireEvent.keyDown(cell(0, 1), { key: "ArrowDown" });
    expect(document.activeElement).toBe(cell(1, 1));
    fireEvent.keyDown(cell(1, 1), { key: "End" });
    expect(document.activeElement).toBe(cell(1, 3));
  });

  test("does nothing when disabled", () => {
    const { cell, onValueChange } = renderSequencer({ disabled: true });
    press(cell(0, 1), 12, 3);
    fireEvent.keyDown(cell(0, 0), { key: " " });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(cell(0, 0).hasAttribute("disabled")).toBe(true);
  });

  test("follows a controlled pattern", () => {
    const { cell } = renderSequencer({
      defaultValue: undefined,
      value: [
        [false, true, false, false],
        [false, false, false, false],
      ],
    });
    expect(cell(0, 1).getAttribute("aria-pressed")).toBe("true");
  });

  test("marks the step being played on its cells ", () => {
    const step = createSource(1);
    const { cell } = renderSequencer({ source: step });
    expect(cell(0, 1).hasAttribute("data-current")).toBe(true);
    expect(cell(1, 1).hasAttribute("data-current")).toBe(true);
    expect(cell(0, 0).hasAttribute("data-current")).toBe(false);
    act(() => step.set(2));
    expect(cell(0, 1).hasAttribute("data-current")).toBe(false);
    expect(cell(1, 2).hasAttribute("data-current")).toBe(true);
    act(() => step.set(-1));
    expect(cell(1, 2).hasAttribute("data-current")).toBe(false);
  });

  test("a cell needs a row", () => {
    expect(() =>
      render(
        <Sequencer.Root defaultValue={[[false]]}>
          <Sequencer.Cell step={0} />
        </Sequencer.Root>
      )
    ).toThrow("Sequencer.Cell must be used within Sequencer.Row");
  });
});
