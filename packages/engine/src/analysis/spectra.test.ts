import { describe, expect, test } from "bun:test";
import { SPECTRA_SIZE, spectrogramSpectra } from "./spectra.ts";

const RATE = 48_000;
const BINS = SPECTRA_SIZE / 2 + 1;
const reader = (signal: Float32Array) => ({
  frames: signal.length,
  read: (from: number, to: number) => signal.subarray(from, to),
});
/** dB as the byte gives it. */
const decibels = (byte: number) => byte / 1.6 - 150;

describe("spectrogramSpectra", () => {
  test("a column every hop, a byte per bin to Nyquist", async () => {
    const spectra = await spectrogramSpectra(reader(new Float32Array(10_000)));
    expect(spectra.size).toBe(SPECTRA_SIZE);
    expect(spectra.hop).toBe(SPECTRA_SIZE);
    expect(spectra.levels).toHaveLength(
      Math.ceil(10_000 / SPECTRA_SIZE) * BINS
    );
  });

  test("silence is 0, and a full-scale sine on its bin reads 0 dB there", async () => {
    const bin = 64;
    const signal = Float32Array.from({ length: SPECTRA_SIZE * 8 }, (_, index) =>
      Math.sin((2 * Math.PI * bin * index) / SPECTRA_SIZE)
    );
    const spectra = await spectrogramSpectra(reader(signal));
    const column = spectra.levels.subarray(3 * BINS, 4 * BINS);
    expect(Math.abs(decibels(column[bin] as number))).toBeLessThan(0.35);
    expect(Math.max(...column)).toBe(column[bin] as number);
    const quiet = await spectrogramSpectra(
      reader(new Float32Array(SPECTRA_SIZE * 2))
    );
    expect(quiet.levels.every((byte) => byte === 0)).toBe(true);
  });

  test("a sine half as loud reads 6 dB lower", async () => {
    const tone = (gain: number) =>
      Float32Array.from(
        { length: SPECTRA_SIZE * 4 },
        (_, index) => gain * Math.sin((2 * Math.PI * 1000 * index) / RATE)
      );
    const loud = await spectrogramSpectra(reader(tone(1)));
    const soft = await spectrogramSpectra(reader(tone(0.5)));
    const at = BINS + Math.round((1000 / RATE) * SPECTRA_SIZE);
    const drop =
      decibels(loud.levels[at] as number) - decibels(soft.levels[at] as number);
    expect(drop).toBeGreaterThan(5.4);
    expect(drop).toBeLessThan(6.7);
  });

  test("a reader that gives its frames later, in any stretches, makes the same spectra", async () => {
    const signal = Float32Array.from(
      { length: 3_000_000 },
      (_, index) => Math.sin(index / 3) * Math.cos(index / 1000)
    );
    const now = await spectrogramSpectra(reader(signal));
    const later = await spectrogramSpectra({
      frames: signal.length,
      read: (from, to) => Promise.resolve(signal.slice(from, to)),
    });
    expect(later.levels).toEqual(now.levels);
  });
});
