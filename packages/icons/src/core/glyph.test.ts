import { describe, expect, test } from "bun:test";
import { draw } from "./draw.ts";
import { curveGlyph } from "./glyph.ts";

const lineOf = (shape: (input: number) => number, options = {}) =>
  curveGlyph(shape, options).find((item) => !item.backdrop)?.attrs.d as string;

describe("curveGlyph", () => {
  test("a rising line runs from the bottom left to the top right of the grid, inside its margin", () => {
    const d = lineOf((input) => input);
    expect(d.startsWith("M3 21L")).toBe(true);
    expect(d.endsWith("L21 3")).toBe(true);
  });

  test("an output out of its range is held at the edge", () => {
    const d = lineOf(() => 5);
    expect(d.startsWith("M3 3L")).toBe(true);
    expect(d.endsWith("L21 3")).toBe(true);
  });

  test("the input and output ranges are the ones given", () => {
    const d = lineOf((p) => p, { from: 0, max: 1, min: 0, to: 1 });
    expect(d.startsWith("M3 21L")).toBe(true);
    expect(d.endsWith("L21 3")).toBe(true);
  });

  test("it has a tint under it in duotone, and is a bold line in fill", () => {
    const glyph = curveGlyph((input) => input);
    expect(draw(glyph, "duotone", "x").nodes).toHaveLength(2);
    expect(draw(glyph, "fill", "x").strokeWidth).toBe(2.25);
  });
});
