import { describe, expect, test } from "bun:test";
import { bypassesGrid, snapMove, snapToGrid } from "../../internal/snap";

const grid = { offset: 0, step: 4 };

describe("snapToGrid", () => {
  test("lands on the nearest line", () => {
    expect(snapToGrid(5, grid)).toBe(4);
    expect(snapToGrid(6.5, grid)).toBe(8);
  });

  test("counts lines from the offset", () => {
    expect(snapToGrid(5, { offset: 1, step: 4 })).toBe(5);
    expect(snapToGrid(7.5, { offset: 1, step: 4 })).toBe(9);
  });

  test("leaves values alone without a grid", () => {
    expect(snapToGrid(5.3, { offset: 0, step: 0 })).toBe(5.3);
  });
});

describe("snapMove", () => {
  test("lands on a line when that is nearer the pointer", () => {
    // From 1, the pointer says 7.8: the line at 8 is nearer than 1 + 2 steps = 9
    expect(snapMove(7.8, 1, grid)).toBe(8);
  });

  test("moves by whole steps when that is nearer, keeping an off-grid offset", () => {
    // From 1, the pointer says 5.1: 1 + 1 step = 5 is nearer than the line at 4
    expect(snapMove(5.1, 1, grid)).toBe(5);
  });

  test("leaves values alone without a grid", () => {
    expect(snapMove(5.1, 1, { offset: 0, step: 0 })).toBe(5.1);
  });
});

describe("bypassesGrid", () => {
  test("is Cmd or Ctrl, never Alt or Shift", () => {
    expect(bypassesGrid({ metaKey: true })).toBe(true);
    expect(bypassesGrid({ ctrlKey: true })).toBe(true);
    expect(bypassesGrid({})).toBe(false);
  });
});
