import { describe, expect, test } from "bun:test";
import {
  LINEAR_SCALE,
  LOGARITHMIC_SCALE,
} from "../../../internal/parameter-scale";
import { curvePath } from "../../internal/path";

const linear = (min: number, max: number) => ({
  max,
  min,
  scale: LINEAR_SCALE,
});

describe("curvePath", () => {
  test("draws y = fn(x) in a unit box with y going up", () => {
    const path = curvePath((x) => x, linear(0, 1), linear(0, 1), 3);
    expect(path).toBe("M 0 1 L 0.5 0.5 L 1 0");
  });

  test("keeps the y axis' own range, clamping what leaves it", () => {
    const path = curvePath(() => 50, linear(0, 1), linear(0, 10), 2);
    expect(path).toBe("M 0 0 L 1 0");
  });

  test("spreads the samples along a logarithmic axis, not along the values", () => {
    const x = { max: 10_000, min: 10, scale: LOGARITHMIC_SCALE };
    const seen: number[] = [];
    curvePath(
      (value) => {
        seen.push(value);
        return 0;
      },
      x,
      linear(0, 1),
      3
    );
    expect(seen[0]).toBeCloseTo(10);
    expect(seen[1]).toBeCloseTo(316.23, 1);
    expect(seen[2]).toBeCloseTo(10_000);
  });

  test("closes down to fillTo for a filled area", () => {
    const path = curvePath(() => 0.5, linear(0, 1), linear(0, 1), 2, 0);
    expect(path).toBe("M 0 0.5 L 1 0.5 L 1 1 L 0 1 Z");
  });

  test("puts a value that is not a number on the floor of the axis", () => {
    expect(curvePath(() => Number.NaN, linear(0, 1), linear(0, 1), 2)).toBe(
      "M 0 1 L 1 1"
    );
  });
});
