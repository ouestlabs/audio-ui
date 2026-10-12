import { describe, expect, test } from "bun:test";
import {
  logSpectrum,
  SPECTRUM_FLOOR_DB,
} from "@/registry-audio/bases/base/lib/spectrum";

const SAMPLE_RATE = 48_000;
/** 1024 bins of 23.4 Hz each, all quiet but the ones set. */
function bins(loud: Record<number, number> = {}) {
  const values = new Float32Array(1024).fill(-90);
  for (const [bin, db] of Object.entries(loud)) {
    values[Number(bin)] = db;
  }
  return values;
}

describe("logSpectrum", () => {
  test("fills the array it is given and returns it", () => {
    const out = new Float32Array(64);
    expect(logSpectrum(bins(), SAMPLE_RATE, out)).toBe(out);
    expect(out.every((value) => value === -90)).toBe(true);
  });

  test("puts a tone at its place on a logarithmic axis", () => {
    // 1 kHz is bin 1000 / 23.4375 = 42.67: near 43.
    const out = new Float32Array(200);
    logSpectrum(bins({ 43: -10 }), SAMPLE_RATE, out);
    const peak = out.indexOf(Math.max(...out));
    // On 20 Hz to 20 kHz, 1 kHz is 56.5% of the way along.
    expect(peak / (out.length - 1)).toBeGreaterThan(0.54);
    expect(peak / (out.length - 1)).toBeLessThan(0.59);
    expect(out[peak]).toBeGreaterThan(-20);
  });

  test("keeps a narrow peak in the crowded high end by taking the loudest bin", () => {
    const out = new Float32Array(48);
    logSpectrum(bins({ 700: -5 }), SAMPLE_RATE, out);
    expect(Math.max(...out)).toBe(-5);
  });

  test("reads between bins where the analyser has fewer than the axis has points", () => {
    const flat = new Float32Array(1024).fill(-60);
    const out = new Float32Array(300);
    logSpectrum(flat, SAMPLE_RATE, out);
    expect(out[0]).toBeCloseTo(-60, 3);
    expect(out[10]).toBeCloseTo(-60, 3);
  });

  test("turns silence and non-numbers into the floor", () => {
    const silent = new Float32Array(1024).fill(Number.NEGATIVE_INFINITY);
    silent[3] = Number.NaN;
    const out = new Float32Array(32);
    logSpectrum(silent, SAMPLE_RATE, out);
    expect(out.every((value) => value === SPECTRUM_FLOOR_DB)).toBe(true);
  });
});
