import { describe, expect, test } from "bun:test";
import { stereoCorrelation } from "./index";

const sine = (length: number, phase = 0) =>
  Float32Array.from({ length }, (_, index) =>
    Math.sin((2 * Math.PI * index) / 64 + phase)
  );

describe("stereoCorrelation", () => {
  test("is 1 for the same sound on both sides, whatever their levels", () => {
    const left = sine(1024);
    const right = left.map((sample) => sample * 0.25);
    expect(stereoCorrelation(left, left)).toBeCloseTo(1, 9);
    expect(stereoCorrelation(left, right)).toBeCloseTo(1, 9);
  });

  test("is -1 for one side the other upside down, which cancels in mono", () => {
    const left = sine(1024);
    expect(
      stereoCorrelation(
        left,
        left.map((sample) => -sample)
      )
    ).toBeCloseTo(-1, 9);
  });

  test("is 0 for two sides with nothing in common, and for a side alone", () => {
    expect(stereoCorrelation(sine(1024), sine(1024, Math.PI / 2))).toBeCloseTo(
      0,
      6
    );
    expect(stereoCorrelation(sine(1024), new Float32Array(1024))).toBe(0);
  });

  test("is 0 for silence and for nothing, never NaN", () => {
    expect(stereoCorrelation(new Float32Array(64), new Float32Array(64))).toBe(
      0
    );
    expect(stereoCorrelation([], [])).toBe(0);
  });
});
