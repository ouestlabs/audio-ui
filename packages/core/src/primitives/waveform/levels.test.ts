import { describe, expect, test } from "bun:test";
import { fitPeaks, isAudible, loudest } from "./levels.js";

const fitTo = (peaks: ArrayLike<number>, count: number) =>
  fitPeaks(peaks, new Float32Array(count));

describe("loudest / isAudible", () => {
  test("reads magnitudes", () => {
    expect(loudest([0.1, -0.6, 0.3])).toBeCloseTo(0.6);
    expect(loudest([])).toBe(0);
  });

  test("silence stops just under two percent", () => {
    expect(isAudible([0, 0.019])).toBe(false);
    expect(isAudible([0, 0.02])).toBe(true);
  });
});

describe("fitPeaks", () => {
  test("keeps the loudest peak of each bar's slice, so transients survive", () => {
    const peaks = [0.1, 0.9, 0.2, 0.2, 0.5, 0.4];
    expect(Array.from(fitTo(peaks, 3))).toEqual([
      Math.fround(0.9),
      Math.fround(0.2),
      Math.fround(0.5),
    ]);
  });

  test("blends neighbouring peaks when there are fewer peaks than bars", () => {
    expect(Array.from(fitTo([0.25, 0.75], 4))).toEqual([
      0.25, 0.375, 0.625, 0.75,
    ]);
  });

  test("reads negative samples as magnitudes and caps levels at 1", () => {
    expect(Array.from(fitTo([-0.5, 3], 2))).toEqual([0.5, 1]);
    expect(Array.from(fitTo([-0.5], 2))).toEqual([0.5, 0.5]);
  });

  test("returns silence for empty data", () => {
    expect(Array.from(fitTo([], 3))).toEqual([0, 0, 0]);
  });

  test("writes into the array it is given, clearing stale levels", () => {
    const levels = new Float32Array([0.9, 0.9]);
    expect(fitPeaks([], levels)).toBe(levels);
    expect(Array.from(levels)).toEqual([0, 0]);
    fitPeaks([0.5, 0.25], levels);
    expect(Array.from(levels)).toEqual([0.5, 0.25]);
  });
});
