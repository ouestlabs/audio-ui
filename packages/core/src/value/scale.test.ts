import { describe, expect, test } from "bun:test";
import { LINEAR_SCALE, LOGARITHMIC_SCALE, resolveScale } from "./scale";

describe("LINEAR_SCALE", () => {
  test("maps the range evenly onto 0…1 and back", () => {
    expect(LINEAR_SCALE.toPosition(-30, -60, 0)).toBe(0.5);
    expect(LINEAR_SCALE.toValue(0.25, -60, 0)).toBe(-45);
  });

  test("keeps positions on the travel", () => {
    expect(LINEAR_SCALE.toPosition(40, 0, 10)).toBe(1);
    expect(LINEAR_SCALE.toValue(-1, 0, 10)).toBe(0);
  });
});

describe("LOGARITHMIC_SCALE", () => {
  test("puts the geometric middle in the middle: 632 Hz between 20 Hz and 20 kHz", () => {
    expect(
      LOGARITHMIC_SCALE.toPosition(Math.sqrt(20 * 20_000), 20, 20_000)
    ).toBeCloseTo(0.5);
    expect(LOGARITHMIC_SCALE.toValue(0.5, 20, 20_000)).toBeCloseTo(632.46, 1);
  });

  test("gives every decade the same share of the travel", () => {
    const decade = (from: number, to: number) =>
      LOGARITHMIC_SCALE.toPosition(to, 20, 20_000) -
      LOGARITHMIC_SCALE.toPosition(from, 20, 20_000);
    expect(decade(20, 200)).toBeCloseTo(decade(2000, 20_000));
  });

  test("round-trips", () => {
    const position = LOGARITHMIC_SCALE.toPosition(1234, 20, 20_000);
    expect(LOGARITHMIC_SCALE.toValue(position, 20, 20_000)).toBeCloseTo(1234);
  });

  test("falls back to linear when min is not positive", () => {
    expect(LOGARITHMIC_SCALE.toPosition(5, 0, 10)).toBe(0.5);
    expect(LOGARITHMIC_SCALE.toValue(0.5, -10, 10)).toBe(0);
  });
});

describe("resolveScale", () => {
  test("names the built-in scales, and takes your own", () => {
    expect(resolveScale("linear")).toBe(LINEAR_SCALE);
    expect(resolveScale("log")).toBe(LOGARITHMIC_SCALE);
    const squared = {
      toPosition: (value: number) => Math.sqrt(value),
      toValue: (position: number) => position ** 2,
    };
    expect(resolveScale(squared)).toBe(squared);
  });
});
