import { describe, expect, test } from "bun:test";
import { anchoredScroll, clampZoom, valueAtOffset } from "./scale.js";

describe("clampZoom", () => {
  test("keeps the zoom within its bounds", () => {
    expect(clampZoom(1000, 2, 480)).toBe(480);
    expect(clampZoom(1, 2, 480)).toBe(2);
    expect(clampZoom(96, 2, 480)).toBe(96);
  });

  test("refuses anything that is not a positive number", () => {
    expect(clampZoom(0, 0, 10)).toBeNull();
    expect(clampZoom(Number.NaN, 0, 10)).toBeNull();
    expect(clampZoom(-3, 0, 10)).toBeNull();
  });
});

describe("anchoredScroll / valueAtOffset", () => {
  test("hold the anchored value at the same place through a zoom", () => {
    // 240px of headers before value 0, scrolled 400px, 50px per unit
    const value = valueAtOffset(300, 400, 50, 240);
    expect(value).toBeCloseTo(9.2);
    const scroll = anchoredScroll({ offset: 300, value }, 100, 240);
    expect(valueAtOffset(300, scroll, 100, 240)).toBeCloseTo(value);
  });

  test("never scrolls before the start", () => {
    expect(anchoredScroll({ offset: 500, value: 1 }, 10, 0)).toBe(0);
  });
});
