import { describe, expect, test } from "bun:test";
import { cellAtPoint, isOn, moveFocus, setCell } from "./grid.ts";

const PATTERN = [
  [true, false, false],
  [false, false, true],
];

describe("setCell", () => {
  test("changes one cell and leaves the pattern it was given alone", () => {
    const next = setCell(PATTERN, { row: 0, step: 1 }, true);
    expect(next).toEqual([
      [true, true, false],
      [false, false, true],
    ]);
    expect(PATTERN[0]).toEqual([true, false, false]);
  });
});

describe("isOn", () => {
  test("reads a cell, and anything outside the pattern is off", () => {
    expect(isOn(PATTERN, { row: 1, step: 2 })).toBe(true);
    expect(isOn(PATTERN, { row: 5, step: 0 })).toBe(false);
  });
});

describe("moveFocus", () => {
  test("moves one cell at a time and stops at the edges", () => {
    expect(moveFocus({ row: 0, step: 0 }, "ArrowRight", 2, 3, false)).toEqual({
      row: 0,
      step: 1,
    });
    expect(moveFocus({ row: 0, step: 0 }, "ArrowLeft", 2, 3, false)).toEqual({
      row: 0,
      step: 0,
    });
    expect(moveFocus({ row: 1, step: 2 }, "ArrowDown", 2, 3, false)).toEqual({
      row: 1,
      step: 2,
    });
    expect(moveFocus({ row: 1, step: 2 }, "ArrowUp", 2, 3, false)).toEqual({
      row: 0,
      step: 2,
    });
  });

  test("Home and End go to the ends of the row, and with Ctrl of the grid", () => {
    expect(moveFocus({ row: 1, step: 1 }, "Home", 2, 3, false)).toEqual({
      row: 1,
      step: 0,
    });
    expect(moveFocus({ row: 0, step: 1 }, "End", 2, 3, false)).toEqual({
      row: 0,
      step: 2,
    });
    expect(moveFocus({ row: 1, step: 1 }, "Home", 2, 3, true)).toEqual({
      row: 0,
      step: 0,
    });
    expect(moveFocus({ row: 0, step: 0 }, "End", 2, 3, true)).toEqual({
      row: 1,
      step: 2,
    });
  });

  test("ignores other keys", () => {
    expect(moveFocus({ row: 0, step: 0 }, "a", 2, 3, false)).toBeNull();
  });
});

describe("cellAtPoint", () => {
  const box = (left: number, top: number) =>
    ({ bottom: top + 10, left, right: left + 10, top }) as DOMRect;
  const boxes = [
    ["0:0", box(0, 0)],
    ["0:1", box(10, 0)],
    ["1:0", box(0, 10)],
  ] as const;

  test("finds the cell holding the point", () => {
    expect(cellAtPoint(boxes, 12, 3)).toEqual({ row: 0, step: 1 });
    expect(cellAtPoint(boxes, 3, 15)).toEqual({ row: 1, step: 0 });
  });

  test("finds nothing in a gap or outside", () => {
    expect(cellAtPoint(boxes, 15, 15)).toBeNull();
    expect(cellAtPoint(boxes, -5, 0)).toBeNull();
  });
});
