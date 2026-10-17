import { describe, expect, test } from "bun:test";
import {
  bypassesGrid,
  snapMove,
  snapRangeMove,
  snapSpanMove,
  snapToGrid,
  withoutSnapPoints,
  withSnapRadius,
} from "./snap.ts";

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

describe("snapRangeMove", () => {
  const limits = { duration: 100, minLength: 2 };

  test("a whole range moves by whole steps, keeping its length", () => {
    expect(snapRangeMove([1, 9], "both", 4.4, limits, grid)).toEqual([5, 13]);
  });

  test("a whole range lands on a line when that is nearer", () => {
    expect(snapRangeMove([1, 9], "both", 6.8, limits, grid)).toEqual([8, 16]);
  });

  test("an edge snaps on its own, the other stays", () => {
    expect(snapRangeMove([1, 9], "end", 2.6, limits, grid)).toEqual([1, 12]);
    expect(snapRangeMove([1, 9], "start", -0.8, limits, grid)).toEqual([0, 9]);
  });

  test("never shorter than the minimum, nor off the timeline", () => {
    expect(snapRangeMove([1, 9], "end", -20, limits, grid)).toEqual([1, 3]);
    expect(snapRangeMove([90, 98], "both", 30, limits, grid)).toEqual([
      92, 100,
    ]);
  });
});

describe("snap points", () => {
  const pulling = { offset: 0, points: [7.3, 20], radius: 0.5, step: 1 };

  test("a point within reach wins over the grid line", () => {
    expect(snapToGrid(7.1, pulling)).toBe(7.3);
    expect(snapMove(7.6, 3, pulling)).toBe(7.3);
  });

  test("out of reach, the grid applies as before", () => {
    expect(snapToGrid(6.6, pulling)).toBe(7);
    expect(snapToGrid(6.6, { ...pulling, radius: 0 })).toBe(7);
  });

  test("a span lands either edge on a point, the nearer one", () => {
    // Its end, 4 later, is 0.2 from 20: the span ends there.
    expect(snapSpanMove(15.8, 10, 4, pulling)).toBe(16);
    // Its start is nearer a point than its end.
    expect(snapSpanMove(7.4, 3, 4, pulling)).toBe(7.3);
    // Neither is near one: the start snaps to the grid.
    expect(snapSpanMove(12.2, 10, 4, pulling)).toBe(12);
  });

  test("a gesture leaves out its own edges and sets the reach", () => {
    expect(withoutSnapPoints(pulling, [20]).points).toEqual([7.3]);
    expect(withSnapRadius({ offset: 0, step: 1 }, 3).radius).toBeUndefined();
    expect(withSnapRadius(pulling, 3).radius).toBe(3);
  });

  test("a range moved whole lands its end on a point", () => {
    expect(
      snapRangeMove(
        [10, 14],
        "both",
        5.8,
        { duration: 100, minLength: 1 },
        grid
      )
    ).toEqual([16, 20]);
  });
});
