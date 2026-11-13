import { describe, expect, test } from "bun:test";
import { bandShares, createBandSplit, splitBands } from "./tint.ts";

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

describe("splitBands", () => {
  const rms = (values: Float32Array) =>
    Math.sqrt(
      values.reduce((sum, value) => sum + value * value, 0) / values.length
    );

  test("each tone lands in its band", () => {
    const [low, mid, high] = [sine(80), sine(800), sine(8000)];
    const together = low.map(
      (value, index) => value + (mid[index] as number) + (high[index] as number)
    );
    const bands = splitBands([together], RATE);
    expect(rms(bands.low)).toBeGreaterThan(0.25);
    expect(rms(bands.low)).toBeLessThan(0.45);
    expect(rms(bands.mid)).toBeGreaterThan(0.25);
    expect(rms(bands.high)).toBeGreaterThan(0.25);
  });

  test("the bands add back to the mix", () => {
    const mix = sine(1000);
    const { high, low, mid } = splitBands([mix], RATE);
    // A crossover that sums flat: past its start-up, low + mid + high is the mix, to a fraction of a dB.
    const summed = mix.map(
      (_, index) =>
        (low[index] as number) +
        (mid[index] as number) +
        (high[index] as number)
    );
    expect(rms(summed.subarray(RATE / 2))).toBeCloseTo(
      rms(mix.subarray(RATE / 2)),
      1
    );
  });

  test("each band reports its own loudest sample", () => {
    const { high, low, mid, peaks } = splitBands([sine(80)], RATE);
    expect(peaks.low).toBeCloseTo(Math.max(...low.map(Math.abs)), 6);
    expect(peaks.low).toBeGreaterThan(peaks.mid * 5);
    expect(peaks.low).toBeGreaterThan(peaks.high * 5);
    expect(Math.max(...mid.map(Math.abs))).toBe(peaks.mid);
    expect(Math.max(...high.map(Math.abs))).toBe(peaks.high);
  });

  test("silence stays silent and a source is not changed", () => {
    const quiet = new Float32Array(1000);
    const bands = splitBands([quiet], RATE);
    expect(Math.max(...bands.low, ...bands.mid, ...bands.high)).toBe(0);
    const source = sine(300, 1);
    const copy = Float32Array.from(source);
    splitBands([source], RATE);
    expect(source).toEqual(copy);
  });
});

describe("createBandSplit", () => {
  test("stretches split in order are the sound split whole", () => {
    const sound = Float32Array.from(
      { length: 20_000 },
      (_, index) => Math.sin(index / 9) + 0.3 * Math.sin(index / 1.3)
    );
    const whole = splitBands([sound], RATE);
    const split = createBandSplit(RATE);
    const parts = [
      split(sound.subarray(0, 7000)),
      split(sound.subarray(7000, 7001)),
      split(sound.subarray(7001)),
    ];
    for (const band of ["low", "mid", "high"] as const) {
      const joined = new Float32Array(sound.length);
      let offset = 0;
      for (const part of parts) {
        joined.set(part[band], offset);
        offset += part[band].length;
      }
      const most = joined.reduce(
        (top, value, index) =>
          Math.max(top, Math.abs(value - (whole[band][index] as number))),
        0
      );
      expect(most).toBeLessThan(1e-6);
    }
  });

  test("a stretch read on its own settles to the whole split after some tens of milliseconds", () => {
    const sound = Float32Array.from(
      { length: 40_000 },
      (_, index) => Math.sin(index / 9) + 0.3 * Math.sin(index / 1.3)
    );
    const whole = splitBands([sound], RATE);
    const from = 20_000;
    const preroll = 8192;
    const alone = createBandSplit(RATE)(sound.subarray(from - preroll));
    const most = alone.low
      .subarray(preroll)
      .reduce(
        (top, value, index) =>
          Math.max(top, Math.abs(value - (whole.low[from + index] as number))),
        0
      );
    expect(most).toBeLessThan(1e-4);
  });
});
