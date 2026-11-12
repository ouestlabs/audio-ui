import { describe, expect, test } from "bun:test";
import {
  DITHER_METHODS,
  ditherChannels,
  filterChannels,
  gainChannels,
  normalizeChannels,
  panChannels,
} from "./process.ts";

const RATE = 48_000;
const sine = (frequency: number, amplitude: number, seconds = 1) =>
  Float32Array.from(
    { length: RATE * seconds },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / RATE)
  );
const peakOf = (channel: Float32Array) =>
  channel.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
const rmsOf = (channel: Float32Array) =>
  Math.sqrt(
    channel.reduce((sum, sample) => sum + sample * sample, 0) / channel.length
  );

describe("gainChannels", () => {
  test("6 dB doubles the samples, about", () => {
    const [out] = gainChannels([Float32Array.of(0.25)], 6.0206);
    expect(out?.[0]).toBeCloseTo(0.5, 4);
  });
});

describe("normalizeChannels", () => {
  test("brings the peak to the target on every channel by one gain", () => {
    const quiet = sine(440, 0.25);
    const quieter = sine(440, 0.125);
    const [left, right] = normalizeChannels([quiet, quieter], RATE, {
      peak: -1,
    });
    expect(peakOf(left ?? new Float32Array())).toBeCloseTo(10 ** (-1 / 20), 3);
    expect(peakOf(right ?? new Float32Array())).toBeCloseTo(
      0.5 * 10 ** (-1 / 20),
      3
    );
  });

  test("silence comes back as it is", () => {
    const silence = new Float32Array(100);
    expect(normalizeChannels([silence], RATE, { peak: -1 })[0]).toEqual(
      silence
    );
  });

  test("a loudness target moves the loudness toward it", () => {
    const [out] = normalizeChannels([sine(1000, 0.05, 3)], RATE, {
      ceiling: 0,
      lufs: -23,
    });
    expect(rmsOf(out ?? new Float32Array())).toBeGreaterThan(0.05 / Math.SQRT2);
  });
});

describe("panChannels", () => {
  test("all the way left silences the right and keeps the left", () => {
    const [left, right] = panChannels([sine(440, 0.5), sine(440, 0.5)], -1);
    expect(peakOf(left ?? new Float32Array())).toBeCloseTo(0.5, 3);
    expect(peakOf(right ?? new Float32Array())).toBe(0);
  });

  test("the centre changes nothing", () => {
    const stereo = [sine(440, 0.5), sine(440, 0.25)];
    expect(panChannels(stereo, 0)).toEqual(stereo);
  });

  test("a mono sound is placed on a stereo pair, and a surround one is left alone", () => {
    const [left, right] = panChannels([sine(440, 0.5)], 1);
    expect(peakOf(left ?? new Float32Array())).toBe(0);
    expect(peakOf(right ?? new Float32Array())).toBeCloseTo(0.5, 3);
    const surround = Array.from({ length: 6 }, () => sine(440, 0.1));
    expect(panChannels(surround, 1)).toEqual(surround);
  });
});

describe("filterChannels", () => {
  test("a low-pass takes the highs down and leaves the lows", () => {
    const [low] = filterChannels([sine(100, 0.5)], RATE, {
      frequency: 1000,
      type: "lowpass",
    });
    const [high] = filterChannels([sine(10_000, 0.5)], RATE, {
      frequency: 1000,
      type: "lowpass",
    });
    expect(rmsOf(low ?? new Float32Array())).toBeGreaterThan(0.3);
    expect(rmsOf(high ?? new Float32Array())).toBeLessThan(0.02);
  });

  test("a high-pass does the reverse, and the source is not changed", () => {
    const source = sine(50, 0.5);
    const copy = Float32Array.from(source);
    const [out] = filterChannels([source], RATE, {
      frequency: 1000,
      type: "highpass",
    });
    expect(rmsOf(out ?? new Float32Array())).toBeLessThan(0.02);
    expect(source).toEqual(copy);
  });

  test("a frequency past the Nyquist limit comes back as it is", () => {
    const source = sine(440, 0.5);
    expect(
      filterChannels([source], RATE, { frequency: 30_000, type: "lowpass" })[0]
    ).toEqual(source);
  });
});

describe("ditherChannels", () => {
  const steady = [new Float32Array(RATE).fill(0.3)];
  const high = (error: Float32Array) => {
    // The energy of the error's difference from sample to sample: what sits near the top of the band.
    let sum = 0;
    for (let index = 1; index < error.length; index += 1) {
      sum += ((error[index] as number) - (error[index - 1] as number)) ** 2;
    }
    return sum / error.length;
  };
  const errorOf = (out: Float32Array) => out.map((sample) => sample - 0.3);

  test("every method lands on the steps of the depth, and keeps the length", () => {
    for (const method of DITHER_METHODS) {
      const [out] = ditherChannels(steady, 8, method);
      expect(out).toHaveLength(RATE);
      // The feedback method of the atom counts 2^(bits-1) steps, the others one less.
      const steps = method === "feedback" ? 128 : 127;
      for (const sample of (out ?? new Float32Array()).subarray(0, 200)) {
        expect(
          Math.abs(sample * steps - Math.round(sample * steps))
        ).toBeLessThan(1e-3);
      }
    }
  });

  test("the dither makes the average of a steady level come out right", () => {
    const [out] = ditherChannels(steady, 8, "tpdf");
    const mean =
      (out ?? new Float32Array()).reduce((sum, sample) => sum + sample, 0) /
      RATE;
    expect(mean).toBeCloseTo(0.3, 2);
  });

  test("shaped moves the error up: more of it varies from sample to sample than flat", () => {
    const [flat] = ditherChannels(steady, 8, "tpdf");
    const [shaped] = ditherChannels(steady, 8, "shaped");
    expect(high(errorOf(shaped ?? new Float32Array()))).toBeGreaterThan(
      high(errorOf(flat ?? new Float32Array())) * 2
    );
  });

  test("the source is left as it is", () => {
    const channel = Float32Array.of(0.1234, -0.5);
    const copy = Float32Array.from(channel);
    ditherChannels([channel], 8);
    expect(channel).toEqual(copy);
  });
});
