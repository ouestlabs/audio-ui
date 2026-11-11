import { describe, expect, test } from "bun:test";
import { playedVelocity } from "./note.ts";

/** A random source that answers `values` in turn. */
const rolls = (...values: number[]) => {
  let at = 0;
  return () => values[at++ % values.length] as number;
};

describe("playedVelocity", () => {
  test("plays a note at its velocity, full when it has none", () => {
    expect(playedVelocity({ velocity: 0.6 }, rolls(0.5))).toBe(0.6);
    expect(playedVelocity({}, rolls(0.5))).toBe(1);
  });

  test("never plays a deactivated note", () => {
    expect(playedVelocity({ muted: true, velocity: 1 }, rolls(0))).toBeNull();
  });

  test("plays a note with a chance that share of the times", () => {
    expect(playedVelocity({ chance: 0.5 }, rolls(0.49, 0))).toBe(1);
    expect(playedVelocity({ chance: 0.5 }, rolls(0.5, 0))).toBeNull();
  });

  test("strays the velocity by up to its deviation, either way, kept within 0 and 1", () => {
    expect(
      playedVelocity({ deviation: 0.2, velocity: 0.5 }, rolls(0, 0.5))
    ).toBeCloseTo(0.6);
    expect(
      playedVelocity({ deviation: -0.4, velocity: 0.5 }, rolls(0, 1))
    ).toBeCloseTo(0.1);
    expect(playedVelocity({ deviation: 1, velocity: 0.8 }, rolls(0, 1))).toBe(
      1
    );
  });
});
