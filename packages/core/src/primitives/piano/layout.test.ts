import { describe, expect, test } from "bun:test";
import { keyAt, placeKeys } from "./layout.js";

const OCTAVE = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60];

describe("placeKeys", () => {
  test("lays white keys side by side and centers black ones on their edges", () => {
    const [c, cSharp, d] = placeKeys(OCTAVE, "keyboard");
    expect(c).toEqual({ black: false, pitch: 48, size: 1 / 8, start: 0 });
    expect(d?.start).toBe(1 / 8);
    expect(cSharp?.black).toBe(true);
    expect(cSharp?.size).toBeCloseTo(0.65 / 8);
    const middle = cSharp ? cSharp.start + cSharp.size / 2 : 0;
    expect(middle).toBeCloseTo(1 / 8);
  });

  test("gives every key the same share in the even layout", () => {
    const keys = placeKeys([60, 62, 65, 67], "even");
    expect(keys.map((key) => key.start)).toEqual([0, 0.25, 0.5, 0.75]);
    expect(keys.every((key) => key.size === 0.25)).toBe(true);
  });
});

describe("keyAt", () => {
  const keys = placeKeys(OCTAVE, "keyboard");

  test("finds a black key near the back and the white key below it near the front", () => {
    expect(keyAt(keys, 1 / 8, 0.2, "keyboard")?.pitch).toBe(49);
    expect(keyAt(keys, 1 / 8 - 0.01, 0.9, "keyboard")?.pitch).toBe(48);
  });

  test("ignores the depth in the even layout", () => {
    const even = placeKeys(OCTAVE, "even");
    expect(keyAt(even, 1.5 / 13, 0.9, "even")?.pitch).toBe(49);
  });

  test("finds nothing past either end", () => {
    expect(keyAt(keys, -0.1, 0.9, "keyboard")).toBeNull();
    expect(keyAt(keys, 1, 0.9, "keyboard")).toBeNull();
  });
});
