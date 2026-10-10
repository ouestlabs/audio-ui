import { describe, expect, test } from "bun:test";
import { createLevelHistory } from "../../internal/level-history";

const rounded = (levels: Float32Array) =>
  Array.from(levels, (level) => Math.round(level * 100) / 100);

describe("createLevelHistory", () => {
  test("records one entry per interval, the oldest pushed out first", () => {
    const history = createLevelHistory(3, 50);
    for (const level of [0.2, 0.4, 0.6, 0.8]) {
      history.feed(level);
      history.step(50);
    }
    expect(rounded(history.levels)).toEqual([0.4, 0.6, 0.8]);
  });

  test("an entry keeps the loudest level given during its interval", () => {
    const history = createLevelHistory(2, 50);
    history.feed(0.3);
    history.step(20);
    history.feed(0.9);
    history.step(20);
    history.feed(0.1);
    history.step(10);
    expect(rounded(history.levels)).toEqual([0, 0.9]);
  });

  test("reports how far the newest entry has slid in", () => {
    const history = createLevelHistory(2, 50);
    history.feed(0.5);
    history.step(50);
    expect(history.progress).toBe(0);
    history.feed(0.5);
    history.step(20);
    expect(history.progress).toBeCloseTo(0.4);
  });

  test("a slow signal holds its level between readings", () => {
    const history = createLevelHistory(3, 50);
    history.feed(0.7);
    history.step(50);
    history.step(50);
    history.step(50);
    expect(rounded(history.levels)).toEqual([0.7, 0.7, 0.7]);
  });

  test("holds still once the signal stops, and resumes where it was", () => {
    const history = createLevelHistory(2, 50);
    history.feed(0.5);
    expect(history.step(50)).toBe(true);
    expect(history.step(100)).toBe(true);
    expect(history.step(100)).toBe(true);
    const frozen = rounded(history.levels);

    expect(history.step(100)).toBe(false);
    expect(history.step(100)).toBe(false);
    expect(rounded(history.levels)).toEqual(frozen);

    history.feed(0.9);
    expect(history.step(50)).toBe(true);
    expect(rounded(history.levels).at(-1)).toBe(0.9);
  });

  test("catches up over a long step without losing entries", () => {
    const history = createLevelHistory(4, 25);
    history.feed(0.6);
    history.step(100);
    expect(rounded(history.levels)).toEqual([0.6, 0.6, 0.6, 0.6]);
  });

  test("carries the newest entries of an earlier history over", () => {
    const wider = createLevelHistory(5, 50, new Float32Array([0.1, 0.2, 0.3]));
    expect(rounded(wider.levels)).toEqual([0, 0, 0.1, 0.2, 0.3]);
    const narrower = createLevelHistory(
      2,
      50,
      new Float32Array([0.1, 0.2, 0.3])
    );
    expect(rounded(narrower.levels)).toEqual([0.2, 0.3]);
  });
});
