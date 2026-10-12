import { describe, expect, test } from "bun:test";
import { adjacentPoint } from "./locators.ts";

const points = [30, 10, 20];

describe("adjacentPoint", () => {
  test("finds the next point after a position, whatever the order", () => {
    expect(adjacentPoint(points, 10, 1)).toBe(20);
    expect(adjacentPoint(points, 0, 1)).toBe(10);
  });

  test("finds the previous point before a position", () => {
    expect(adjacentPoint(points, 30, -1)).toBe(20);
    expect(adjacentPoint(points, 25, -1)).toBe(20);
  });

  test("is strict: standing on a point goes past it", () => {
    expect(adjacentPoint(points, 20, 1)).toBe(30);
    expect(adjacentPoint(points, 20, -1)).toBe(10);
  });

  test("is null when nothing lies that way", () => {
    expect(adjacentPoint(points, 30, 1)).toBeNull();
    expect(adjacentPoint(points, 10, -1)).toBeNull();
    expect(adjacentPoint([], 5, 1)).toBeNull();
  });
});
