import { describe, expect, test } from "bun:test";
import { moveRange, normalizeRange } from "./range.ts";

const limits = { duration: 100, minLength: 5 };

describe("normalizeRange", () => {
  test("orders the edges and keeps them on the timeline", () => {
    expect(normalizeRange([60, 20], 100)).toEqual([20, 60]);
    expect(normalizeRange([-10, 140], 100)).toEqual([0, 100]);
    expect(normalizeRange([Number.NaN, 30], 100)).toEqual([0, 30]);
  });
});

describe("moveRange", () => {
  test("moves the whole region, keeping its length", () => {
    expect(moveRange([20, 40], "both", 15, limits)).toEqual([35, 55]);
  });

  test("a moved region stops at both ends of the timeline", () => {
    expect(moveRange([20, 40], "both", 500, limits)).toEqual([80, 100]);
    expect(moveRange([20, 40], "both", -500, limits)).toEqual([0, 20]);
  });

  test("the start edge stops at 0 and a minimum length before the end", () => {
    expect(moveRange([20, 40], "start", -50, limits)).toEqual([0, 40]);
    expect(moveRange([20, 40], "start", 50, limits)).toEqual([35, 40]);
  });

  test("the end edge stops a minimum length after the start and at the duration", () => {
    expect(moveRange([20, 40], "end", -50, limits)).toEqual([20, 25]);
    expect(moveRange([20, 40], "end", 500, limits)).toEqual([20, 100]);
  });
});
