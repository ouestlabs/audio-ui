import { describe, expect, test } from "bun:test";
import { detectPitch } from "./detect.ts";

const SAMPLE_RATE = 48_000;
const SIZE = 4096;

/** `SIZE` samples of a tone: `harmonics` partials at `frequency`, each `1 / n` as loud as the one before. */
function tone(
  frequency: number,
  harmonics = 1,
  amplitude = 0.5,
  rate = SAMPLE_RATE
) {
  const samples = new Float32Array(SIZE);
  for (let index = 0; index < SIZE; index += 1) {
    for (let harmonic = 1; harmonic <= harmonics; harmonic += 1) {
      samples[index] =
        (samples[index] ?? 0) +
        (amplitude / harmonic) *
          Math.sin((2 * Math.PI * frequency * harmonic * index) / rate);
    }
  }
  return samples;
}

/** A tone whose second partial is louder than its fundamental: a plucked string, a clarinet. */
function weakFundamental(frequency: number) {
  const samples = new Float32Array(SIZE);
  for (let index = 0; index < SIZE; index += 1) {
    const phase = (2 * Math.PI * frequency * index) / SAMPLE_RATE;
    samples[index] =
      0.2 * Math.sin(phase) +
      0.5 * Math.sin(2 * phase) +
      0.3 * Math.sin(3 * phase);
  }
  return samples;
}

const cents = (found: number, expected: number) =>
  1200 * Math.log2(found / expected);

describe("detectPitch", () => {
  test("finds a sine's frequency to within a cent, from a bass string to a high note", () => {
    for (const frequency of [41.2, 82.41, 110, 261.63, 440, 987.77, 1760]) {
      const found = detectPitch(tone(frequency), SAMPLE_RATE);
      expect(found).not.toBeNull();
      expect(Math.abs(cents(found?.frequency ?? 1, frequency))).toBeLessThan(1);
    }
  });

  test("works at the other common sample rates", () => {
    for (const rate of [22_050, 44_100, 96_000]) {
      const samples = tone(220, 1, 0.5, rate);
      const found = detectPitch(samples, rate);
      expect(Math.abs(cents(found?.frequency ?? 1, 220))).toBeLessThan(1);
    }
  });

  test("finds the fundamental of a tone rich in harmonics", () => {
    expect(detectPitch(tone(196, 6), SAMPLE_RATE)?.frequency).toBeCloseTo(
      196,
      0
    );
  });

  test("finds the fundamental when the second partial is louder", () => {
    const found = detectPitch(weakFundamental(110), SAMPLE_RATE);
    expect(Math.abs(cents(found?.frequency ?? 1, 110))).toBeLessThan(2);
  });

  test("is confident about a clean tone", () => {
    expect(detectPitch(tone(440), SAMPLE_RATE)?.confidence).toBeGreaterThan(
      0.95
    );
  });

  test("hears nothing in silence or below the level floor", () => {
    expect(detectPitch(new Float32Array(SIZE), SAMPLE_RATE)).toBeNull();
    expect(detectPitch(tone(440, 1, 0.001), SAMPLE_RATE)).toBeNull();
  });

  test("hears nothing in noise", () => {
    let seed = 1;
    const noise = Float32Array.from({ length: SIZE }, () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return (seed / 2_147_483_647 - 0.5) * 0.5;
    });
    expect(detectPitch(noise, SAMPLE_RATE)).toBeNull();
  });

  test("searches no higher than maxHz and no lower than minHz", () => {
    const high = detectPitch(tone(440), SAMPLE_RATE, { maxHz: 300 });
    // A 440 Hz sine also repeats every two periods: the octave below is in range.
    expect(high?.frequency).toBeCloseTo(220, 0);
    for (const frequency of [330, 700, 1000, 1500]) {
      const found = detectPitch(tone(frequency), SAMPLE_RATE, { maxHz: 300 });
      // The search stops at maxHz's period; the result may land a hair past it.
      expect(found?.frequency ?? 0).toBeLessThan(301);
    }
    expect(detectPitch(tone(110), SAMPLE_RATE, { minHz: 200 })).toBeNull();
  });

  test("needs two periods of a pitch in its samples to hear it", () => {
    expect(detectPitch(tone(440).slice(0, 256), SAMPLE_RATE)).not.toBeNull();
    expect(detectPitch(tone(110).slice(0, 256), SAMPLE_RATE)).toBeNull();
  });

  test("returns null, never throws, for input it cannot read", () => {
    expect(detectPitch(new Float32Array(0), SAMPLE_RATE)).toBeNull();
    expect(detectPitch(tone(440), 0)).toBeNull();
    expect(detectPitch(tone(440), -48_000)).toBeNull();
    expect(detectPitch(tone(440), Number.NaN)).toBeNull();
    expect(detectPitch(tone(440), Number.POSITIVE_INFINITY)).toBeNull();
    expect(
      detectPitch(new Float32Array(SIZE).fill(Number.NaN), SAMPLE_RATE)
    ).toBeNull();
  });

  test("does not change the samples it is given", () => {
    const samples = tone(440);
    const copy = samples.slice();
    detectPitch(samples, SAMPLE_RATE);
    expect(samples).toEqual(copy);
  });
});
