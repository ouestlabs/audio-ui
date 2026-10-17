import { describe, expect, test } from "bun:test";
import {
  CURVE_RATE,
  curveForMidpoint,
  curveSamples,
  segmentShape,
} from "./geometry.ts";

describe("segmentShape", () => {
  test("is a straight line without a curve, and from 0 to 1 with one", () => {
    expect(segmentShape(0.3, undefined)).toBe(0.3);
    expect(segmentShape(0.3, 0)).toBe(0.3);
    for (const curve of [-1, -0.4, 0.4, 1]) {
      expect(segmentShape(0, curve)).toBeCloseTo(0, 12);
      expect(segmentShape(1, curve)).toBeCloseTo(1, 12);
    }
  });

  test("is the exponential of an analog envelope stage", () => {
    const rate = 0.5 * CURVE_RATE;
    expect(segmentShape(0.3, 0.5)).toBeCloseTo(
      (Math.exp(rate * 0.3) - 1) / (Math.exp(rate) - 1),
      12
    );
  });

  test("a positive curve holds the start and rushes the end, a negative one the opposite", () => {
    expect(segmentShape(0.5, 0.6)).toBeLessThan(0.5);
    expect(segmentShape(0.5, -0.6)).toBeGreaterThan(0.5);
  });

  test("a curve and its opposite are mirror images", () => {
    for (const t of [0.1, 0.37, 0.8]) {
      expect(segmentShape(t, -0.7)).toBeCloseTo(
        1 - segmentShape(1 - t, 0.7),
        12
      );
    }
  });

  test("at the full curve the middle sits at about 0.4% of the rise", () => {
    expect(segmentShape(0.5, 1)).toBeCloseTo(0.004, 3);
    expect(segmentShape(0.5, -1)).toBeCloseTo(0.996, 3);
  });

  test("never turns vertical, even at the full curve either way", () => {
    const step = 1e-4;
    for (const curve of [-1, 1]) {
      const slopeAtStart =
        (segmentShape(step, curve) - segmentShape(0, curve)) / step;
      const slopeAtEnd =
        (segmentShape(1, curve) - segmentShape(1 - step, curve)) / step;
      expect(Math.max(slopeAtStart, slopeAtEnd)).toBeLessThan(CURVE_RATE + 1);
    }
  });
});

describe("curveForMidpoint", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 1, y: 1 };

  test("gives back the curve that puts the middle where it was dragged", () => {
    for (const curve of [-0.9, -0.3, 0.2, 0.9]) {
      const middle = segmentShape(0.5, curve);
      expect(curveForMidpoint(from, to, middle)).toBeCloseTo(curve, 9);
    }
  });

  test("a middle at the half is no curve", () => {
    expect(curveForMidpoint(from, to, 0.5)).toBeCloseTo(0, 12);
  });

  test("a drag to either edge reaches the full curve", () => {
    expect(curveForMidpoint(from, to, 0)).toBe(1);
    expect(curveForMidpoint(from, to, 1)).toBe(-1);
  });
});

describe("curveSamples", () => {
  test("are in order inside the segment, and spread in height as well as in length", () => {
    const samples = curveSamples(0.9);
    expect([...samples].sort((a, b) => a - b)).toEqual(samples);
    expect(samples.every((t) => t > 0 && t < 1)).toBe(true);
    const heights = samples.map((t) => segmentShape(t, 0.9));
    const biggestJump = Math.max(
      ...heights.slice(1).map((height, index) => height - (heights[index] ?? 0))
    );
    expect(biggestJump).toBeLessThan(0.06);
  });
});
