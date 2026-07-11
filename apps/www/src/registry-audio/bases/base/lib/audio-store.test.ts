import { describe, expect, test } from "bun:test";
import { calculateNextIndex, calculatePreviousIndex } from "./audio-store";

const queue = [
  { id: "1", url: "a" },
  { id: "2", url: "b" },
  { id: "3", url: "c" },
];

describe("calculateNextIndex", () => {
  test("advances to the next index", () => {
    expect(
      calculateNextIndex({
        currentQueueIndex: 0,
        queue,
        repeatMode: "none",
        shuffleEnabled: false,
      })
    ).toBe(1);
  });

  test("returns -1 past the end with repeatMode none", () => {
    expect(
      calculateNextIndex({
        currentQueueIndex: 2,
        queue,
        repeatMode: "none",
        shuffleEnabled: false,
      })
    ).toBe(-1);
  });

  test("wraps to 0 past the end with repeatMode all", () => {
    expect(
      calculateNextIndex({
        currentQueueIndex: 2,
        queue,
        repeatMode: "all",
        shuffleEnabled: false,
      })
    ).toBe(0);
  });

  test("returns -1 for an empty queue", () => {
    expect(
      calculateNextIndex({
        currentQueueIndex: 0,
        queue: [],
        repeatMode: "none",
        shuffleEnabled: false,
      })
    ).toBe(-1);
  });

  test("shuffle on a single-track queue with repeatMode none returns -1", () => {
    expect(
      calculateNextIndex({
        currentQueueIndex: 0,
        queue: [queue[0]],
        repeatMode: "none",
        shuffleEnabled: true,
      })
    ).toBe(-1);
  });

  test("shuffle on a single-track queue with repeatMode all returns 0", () => {
    expect(
      calculateNextIndex({
        currentQueueIndex: 0,
        queue: [queue[0]],
        repeatMode: "all",
        shuffleEnabled: true,
      })
    ).toBe(0);
  });

  test("shuffle picks an index different from the current one", () => {
    for (let i = 0; i < 20; i++) {
      const next = calculateNextIndex({
        currentQueueIndex: 1,
        queue,
        repeatMode: "none",
        shuffleEnabled: true,
      });
      expect(next).not.toBe(1);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(queue.length);
    }
  });
});

describe("calculatePreviousIndex", () => {
  test("goes back to the previous index", () => {
    expect(
      calculatePreviousIndex({
        currentQueueIndex: 1,
        queue,
        repeatMode: "none",
        shuffleEnabled: false,
      })
    ).toBe(0);
  });

  test("returns -1 before the start with repeatMode none", () => {
    expect(
      calculatePreviousIndex({
        currentQueueIndex: 0,
        queue,
        repeatMode: "none",
        shuffleEnabled: false,
      })
    ).toBe(-1);
  });

  test("wraps to the end before the start with repeatMode all", () => {
    expect(
      calculatePreviousIndex({
        currentQueueIndex: 0,
        queue,
        repeatMode: "all",
        shuffleEnabled: false,
      })
    ).toBe(2);
  });
});
