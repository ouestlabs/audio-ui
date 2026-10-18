import { describe, expect, test } from "bun:test";
import { levelPosition, vuDeflection } from "./scale.ts";

describe("VU deflection", () => {
  const position = levelPosition(vuDeflection, Number.NEGATIVE_INFINITY, 3);

  test("puts 0 VU at 71% of a scale that ends at +3 VU", () => {
    expect(position(0)).toBeCloseTo(0.708, 3);
    expect(position(3)).toBe(1);
  });

  test("puts the lower marks where the voltage is, not the dB", () => {
    expect(position(-10)).toBeCloseTo(0.224, 3);
    expect(position(-20)).toBeCloseTo(0.071, 3);
  });

  test("leaves the pointer at its left stop in silence, and at the end above the scale", () => {
    expect(position(-60)).toBeLessThan(0.001);
    expect(position(10)).toBe(1);
  });
});
