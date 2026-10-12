import { describe, expect, test } from "bun:test";
import { createLevelHistory } from "./level-history.js";

const rounded = (levels: Float32Array) =>
  Array.from(levels, (level) => Math.round(level * 100) / 100);

describe("createLevelHistory", () => {
  test("records one entry per interval, the oldest pushed out first", () => {
    const history = createLevelHistory(3, 50);
    for (const [index, level] of [0.2, 0.4, 0.6, 0.8].entries()) {
      history.feed(level, index * 50);
      history.step((index + 1) * 50);
    }
    expect(rounded(history.levels)).toEqual([0.4, 0.6, 0.8]);
  });

  test("an entry keeps the loudest level given during its interval", () => {
    const history = createLevelHistory(2, 50);
    history.feed(0.3, 0);
    history.feed(0.9, 20);
    history.feed(0.1, 40);
    history.step(50);
    expect(rounded(history.levels)).toEqual([0, 0.9]);
  });

  test("reports how far the newest entry has slid in", () => {
    const history = createLevelHistory(2, 50);
    history.feed(0.5, 0);
    history.step(50);
    expect(history.progress).toBe(0);
    history.feed(0.5, 60);
    history.step(70);
    expect(history.progress).toBeCloseTo(0.4);
  });

  test("a slow signal holds its level between readings", () => {
    const history = createLevelHistory(3, 50);
    history.feed(0.7, 0);
    history.step(50);
    history.step(100);
    history.step(150);
    expect(rounded(history.levels)).toEqual([0.7, 0.7, 0.7]);
  });

  test("catches up when it is stepped late, as long as levels kept coming", () => {
    const history = createLevelHistory(4, 25);
    for (let ms = 0; ms <= 100; ms += 10) {
      history.feed(0.6, ms);
    }
    expect(history.step(100)).toBe(true);
    expect(rounded(history.levels)).toEqual([0.6, 0.6, 0.6, 0.6]);
    expect(history.progress).toBe(0);
  });

  test("holds still once the signal stops", () => {
    const history = createLevelHistory(2, 50);
    history.feed(0.5, 0);
    expect(history.step(100)).toBe(true);
    expect(history.step(250)).toBe(true);
    const frozen = rounded(history.levels);

    expect(history.step(300)).toBe(false);
    expect(history.step(60_000)).toBe(false);
    expect(rounded(history.levels)).toEqual(frozen);
  });

  test("carries on where it was when the signal comes back, the gap left out", () => {
    const history = createLevelHistory(4, 50);
    history.feed(0.5, 0);
    history.step(100);
    const before = rounded(history.levels);

    history.feed(0.9, 60_000);
    expect(history.step(60_000)).toBe(true);
    expect(rounded(history.levels)).toEqual(before);

    history.step(60_050);
    expect(rounded(history.levels)).toEqual([...before.slice(1), 0.9]);
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
