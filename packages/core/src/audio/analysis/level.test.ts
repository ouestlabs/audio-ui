import { describe, expect, test } from "bun:test";
import { dbToGain, gainToDb, rmsDb } from "./index.ts";

describe("dbToGain and gainToDb", () => {
  test("follow the amplitude convention: 20 dB a decade, 6.02 dB a doubling", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(20)).toBe(10);
    expect(dbToGain(-20)).toBeCloseTo(0.1, 12);
    expect(dbToGain(-6.0206)).toBeCloseTo(0.5, 4);
    expect(gainToDb(1)).toBe(0);
    expect(gainToDb(10)).toBe(20);
    expect(gainToDb(0.5)).toBeCloseTo(-6.0206, 4);
  });

  test("are inverses", () => {
    for (const db of [-96, -40, -6, 0, 3, 12]) {
      expect(gainToDb(dbToGain(db))).toBeCloseTo(db, 9);
    }
  });

  test("give -Infinity for silence and never NaN", () => {
    expect(gainToDb(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(gainToDb(-1)).toBe(Number.NEGATIVE_INFINITY);
    expect(gainToDb(Number.NaN)).toBe(Number.NEGATIVE_INFINITY);
    expect(dbToGain(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("rmsDb", () => {
  const sine = (amplitude: number) =>
    Float32Array.from(
      { length: 4800 },
      (_, index) => amplitude * Math.sin((2 * Math.PI * 100 * index) / 48_000)
    );

  test("is -3 dB for a sine at full scale and 0 dB for a full-scale square", () => {
    expect(rmsDb(sine(1))).toBeCloseTo(-3.0103, 2);
    expect(rmsDb(new Float32Array(100).fill(1))).toBeCloseTo(0, 9);
    expect(rmsDb(new Float32Array(100).fill(-1))).toBeCloseTo(0, 9);
  });

  test("falls 6 dB when the amplitude halves", () => {
    expect(rmsDb(sine(0.5)) - rmsDb(sine(1))).toBeCloseTo(-6.0206, 2);
  });

  test("is -Infinity for silence, nothing, or samples that are not numbers", () => {
    expect(rmsDb(new Float32Array(10))).toBe(Number.NEGATIVE_INFINITY);
    expect(rmsDb([])).toBe(Number.NEGATIVE_INFINITY);
    expect(rmsDb([0.5, Number.NaN])).toBe(Number.NEGATIVE_INFINITY);
  });
});
