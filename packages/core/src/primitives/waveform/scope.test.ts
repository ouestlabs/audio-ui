import { describe, expect, test } from "bun:test";
import { scopePoints } from "./scope";

const options = { gain: 1, height: 100, inset: 2, width: 200 };

describe("scopePoints", () => {
  test("spreads the samples across the width, around the middle", () => {
    expect(scopePoints([0, 1, -1, 0, 0.5], options)).toEqual([
      { x: 0, y: 50 },
      { x: 50, y: 2 },
      { x: 100, y: 98 },
      { x: 150, y: 50 },
      { x: 200, y: 26 },
    ]);
  });

  test("gain scales the trace, which never leaves the canvas", () => {
    const [quiet, loud] = scopePoints([0.25, 0.9], { ...options, gain: 2 });
    expect(quiet?.y).toBe(26);
    expect(loud?.y).toBe(2);
  });

  test("thins out more samples than there are pixel columns", () => {
    const samples = new Float32Array(2048);
    const points = scopePoints(samples, options);
    expect(points.length).toBeLessThanOrEqual(205);
    expect(points.length).toBeGreaterThan(190);
    expect(points.at(-1)?.x).toBeLessThanOrEqual(200);
  });

  test("draws a flat line when there is nothing to trace", () => {
    expect(scopePoints([], options)).toEqual([
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]);
    expect(scopePoints([0.7], options)).toEqual([
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]);
  });
});
