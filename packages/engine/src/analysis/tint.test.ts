import { describe, expect, test } from "bun:test";
import { bandShares } from "./tint.ts";

const RATE = 48_000;
const sine = (frequency: number, seconds = 1) =>
  Float32Array.from(
    { length: RATE * seconds },
    (_, index) => 0.5 * Math.sin((2 * Math.PI * frequency * index) / RATE)
  );
const at = (values: Float32Array, slice: number) => values[slice] as number;

describe("bandShares", () => {
  test("a low tone is all low, a high one all high, a middle one mostly mid", () => {
    const low = bandShares([sine(80)], RATE, 10);
    const mid = bandShares([sine(800)], RATE, 10);
    const high = bandShares([sine(8000)], RATE, 10);
    expect(at(low.low, 5)).toBe(1);
    expect(at(low.high, 5)).toBeLessThan(0.05);
    expect(at(mid.mid, 5)).toBe(1);
    expect(at(high.high, 5)).toBe(1);
    expect(at(high.low, 5)).toBeLessThan(0.05);
  });

  test("each slice reads its own part of the sound", () => {
    const joined = new Float32Array(RATE * 2);
    joined.set(sine(80), 0);
    joined.set(sine(8000), RATE);
    const shares = bandShares([joined], RATE, 4);
    expect(at(shares.low, 0)).toBe(1);
    expect(at(shares.high, 3)).toBe(1);
  });

  test("silence is all zeros, with one slice per count", () => {
    const shares = bandShares([new Float32Array(RATE)], RATE, 8);
    expect(shares.low).toHaveLength(8);
    expect(Math.max(...shares.low, ...shares.mid, ...shares.high)).toBe(0);
  });
});
