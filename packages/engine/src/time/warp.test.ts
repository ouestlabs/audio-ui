import { describe, expect, test } from "bun:test";
import {
  addWarpMarker,
  moveWarpMarker,
  removeWarpMarker,
  scaleWarp,
  unwarpedTime,
  warpedTime,
  warpMarkers,
  warpRate,
} from "./warp.ts";

// The first 4 s of the recording play in 2 s, the next 4 s in 8 s.
const map = [
  { source: 0, target: 0 },
  { source: 4, target: 2 },
  { source: 8, target: 10 },
];

describe("warpedTime and unwarpedTime", () => {
  test("map each stretch evenly, both ways", () => {
    expect(warpedTime(map, 2)).toBe(1);
    expect(warpedTime(map, 6)).toBe(6);
    expect(unwarpedTime(map, 1)).toBe(2);
    expect(unwarpedTime(map, 6)).toBe(6);
  });

  test("past the ends, keep the speed of the stretch next to them", () => {
    expect(warpedTime(map, 10)).toBe(14);
    expect(warpedTime(map, -2)).toBe(-1);
  });

  test("one marker shifts, none leaves time as it is", () => {
    expect(warpedTime([{ source: 1, target: 3 }], 5)).toBe(7);
    expect(warpedTime([], 5)).toBe(5);
  });
});

describe("warpRate", () => {
  test("is how fast the source plays at a time on the clip", () => {
    expect(warpRate(map, 1)).toBeCloseTo(2, 6);
    expect(warpRate(map, 5)).toBeCloseTo(0.5, 6);
  });
});

describe("editing markers", () => {
  test("a marker running back in either time is left out", () => {
    expect(
      warpMarkers([...map, { source: 6, target: 1 }]).map((m) => m.source)
    ).toEqual([0, 4, 8]);
  });

  test("adding one pins what plays there, so nothing moves", () => {
    const added = addWarpMarker(map, 6);
    expect(added).toHaveLength(4);
    expect(warpedTime(added, 6)).toBeCloseTo(warpedTime(map, 6), 9);
  });

  test("moving one stretches both sides and stops short of its neighbours", () => {
    const moved = moveWarpMarker(map, 1, 4);
    expect(warpRate(moved, 1)).toBeCloseTo(1, 6);
    expect(moveWarpMarker(map, 1, 20)[1]?.target).toBeLessThan(10);
  });

  test("two markers are kept to make a map", () => {
    expect(removeWarpMarker(map, 1)).toHaveLength(2);
    expect(removeWarpMarker(removeWarpMarker(map, 1), 0)).toHaveLength(2);
  });

  test("scaling plays it slower or faster from its first marker", () => {
    expect(scaleWarp(map, 2).map((m) => m.target)).toEqual([0, 4, 20]);
    expect(warpRate(scaleWarp(map, 0.5), 0.5)).toBeCloseTo(4, 6);
  });
});
