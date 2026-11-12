import { describe, expect, test } from "bun:test";
import { checkAcx, reportSound } from "./report.ts";

const RATE = 44_100;
const tone = (db: number, seconds: number, frequency = 220) =>
  Float32Array.from(
    { length: Math.round(RATE * seconds) },
    (_, index) =>
      10 ** (db / 20) *
      Math.SQRT2 *
      Math.sin((2 * Math.PI * frequency * index) / RATE)
  );
const silence = (seconds: number) =>
  new Float32Array(Math.round(RATE * seconds));
const join = (...parts: Float32Array[]) => {
  const out = new Float32Array(
    parts.reduce((sum, part) => sum + part.length, 0)
  );
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

describe("checkAcx", () => {
  test("a sound in range, with a quiet pause, passes", () => {
    const sound = join(silence(1), tone(-20, 3), silence(1));
    const report = checkAcx([sound], RATE);
    expect(report.rms.pass).toBe(true);
    expect(report.pass).toBe(true);
    expect(report.peak.value).toBeLessThanOrEqual(-3);
    expect(report.noiseFloor.value).toBe(Number.NEGATIVE_INFINITY);
    expect(report.noiseFloor.pass).toBe(true);
  });

  test("a sound too loud fails its peak and its RMS", () => {
    const report = checkAcx([join(silence(1), tone(-6, 3), silence(1))], RATE);
    expect(report.peak.pass).toBe(false);
    expect(report.rms.pass).toBe(false);
    expect(report.pass).toBe(false);
  });

  test("a sound with no pause has no noise floor to measure, and fails", () => {
    const report = checkAcx([tone(-20, 3)], RATE);
    expect(report.noiseFloor.value).toBeNull();
    expect(report.noiseFloor.pass).toBe(false);
  });
});

describe("reportSound", () => {
  test("reads the duration and the loudness", () => {
    const report = reportSound([tone(-20, 2)], RATE);
    expect(report.duration).toBeCloseTo(2, 2);
    expect(Number.isFinite(report.loudness.lufs)).toBe(true);
  });
});
