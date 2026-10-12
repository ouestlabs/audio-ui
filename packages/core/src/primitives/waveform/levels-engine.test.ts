import { describe, expect, test } from "bun:test";
import {
  createLevelsEngine,
  type LevelsEngineOptions,
} from "./levels-engine.js";

const engineWith = (options: Partial<LevelsEngineOptions> = {}) =>
  createLevelsEngine({
    count: 4,
    gain: 1,
    idle: "none",
    loading: false,
    minLevel: 0,
    mirrored: false,
    reducedMotion: false,
    ...options,
  });

const rounded = (levels: Float32Array) =>
  Array.from(levels, (level) => Math.round(level * 1000) / 1000);

describe("createLevelsEngine", () => {
  test("starts every bar at the resting level", () => {
    expect(rounded(engineWith({ minLevel: 0.08 }).levels)).toEqual([
      0.08, 0.08, 0.08, 0.08,
    ]);
  });

  test("fits the input to the bar count and rises at once", () => {
    const engine = engineWith();
    engine.step(0, [0.2, 0.9, 0.1, 0.1, 0.5, 0.5, 0.3, 0.7]);
    expect(rounded(engine.levels)).toEqual([0.9, 0.1, 0.5, 0.7]);
    expect(engine.settled).toBe(true);
  });

  test("falls smoothly: after one time constant about 37% of the drop remains", () => {
    const engine = engineWith({ count: 1 });
    engine.step(0, [1]);
    engine.step(110, [0]);
    expect(engine.levels[0]).toBeCloseTo(Math.exp(-1), 3);
    expect(engine.settled).toBe(false);

    engine.step(2000, [0]);
    expect(engine.levels[0]).toBeCloseTo(0, 3);
    expect(engine.settled).toBe(true);
  });

  test("never shows less than the resting level, nor more than 1", () => {
    const engine = engineWith({ count: 2, gain: 4, minLevel: 0.08 });
    engine.step(0, [0, 0.5]);
    expect(rounded(engine.levels)).toEqual([0.08, 1]);
  });

  test("gain scales the input", () => {
    const engine = engineWith({ count: 1, gain: 0.5 });
    engine.step(0, [0.8]);
    expect(engine.levels[0]).toBeCloseTo(0.4);
  });

  test("mirrored puts the first level in the middle, the last at both ends", () => {
    const engine = engineWith({ count: 5, mirrored: true });
    engine.step(0, [0.9, 0.5, 0.1]);
    expect(rounded(engine.levels)).toEqual([0.1, 0.5, 0.9, 0.5, 0.1]);

    const even = engineWith({ count: 4, mirrored: true });
    even.step(0, [0.9, 0.3]);
    expect(rounded(even.levels)).toEqual([0.3, 0.9, 0.9, 0.3]);
  });

  test("rests on silence with no idle animation", () => {
    const engine = engineWith();
    engine.step(0, null);
    engine.step(500, null);
    expect(rounded(engine.levels)).toEqual([0, 0, 0, 0]);
    expect(engine.settled).toBe(true);
  });

  test("pulse breathes every bar together while silent, and never settles", () => {
    const engine = engineWith({ idle: "pulse" });
    engine.step(625, null);
    const [first, ...rest] = rounded(engine.levels);
    expect(first).toBeGreaterThan(0.05);
    expect(rest.every((level) => level === first)).toBe(true);
    expect(engine.settled).toBe(false);
  });

  test("wave moves along the bars while silent", () => {
    const engine = engineWith({ count: 12, idle: "wave" });
    engine.step(0, null);
    const levels = rounded(engine.levels);
    expect(new Set(levels).size).toBeGreaterThan(4);
    expect(engine.settled).toBe(false);
  });

  test("a signal takes over from the idle animation", () => {
    const engine = engineWith({ count: 1, idle: "pulse" });
    engine.step(0, [0.6]);
    expect(engine.levels[0]).toBeCloseTo(0.6);
    expect(engine.settled).toBe(true);
  });

  test("loading sweeps a bump across the bars", () => {
    const engine = engineWith({ count: 24, loading: true });
    engine.step(300, null);
    const early = engine.levels.indexOf(Math.max(...engine.levels));
    engine.step(700, null);
    const late = engine.levels.indexOf(Math.max(...engine.levels));
    expect(late).toBeGreaterThan(early);
    expect(engine.settled).toBe(false);
  });

  test("reduced motion: no smoothing, no idle animation, no sweep", () => {
    const engine = engineWith({
      count: 1,
      idle: "pulse",
      loading: true,
      reducedMotion: true,
    });
    engine.step(0, [1]);
    engine.step(16, [0]);
    expect(engine.levels[0]).toBe(0);
    expect(engine.settled).toBe(true);
  });
});
