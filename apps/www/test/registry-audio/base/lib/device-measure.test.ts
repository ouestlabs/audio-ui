import { describe, expect, test } from "bun:test";
import {
  magnitudeDb,
  peakDb,
  peakIndex,
  reverberationTime,
  SAMPLE_RATE,
  toDb,
  toLinear,
} from "@/registry-audio/bases/base/lib/device-measure";

describe("the measuring helpers", () => {
  test("a gain and its decibels are each other's inverse", () => {
    expect(toDb(toLinear(-12))).toBeCloseTo(-12, 9);
    expect(toDb(2)).toBeCloseTo(6.0206, 3);
  });

  test("the response of an impulse of height 2 is +6 dB at every frequency", () => {
    const response = new Float32Array(1024);
    response[0] = 2;
    for (const hertz of [100, 1000, 10_000]) {
      expect(magnitudeDb(response, hertz)).toBeCloseTo(6.0206, 3);
    }
  });

  test("a delayed impulse has the same magnitude and its peak is where it was put", () => {
    const response = new Float32Array(4096);
    response[240] = 1;
    expect(magnitudeDb(response, 3000)).toBeCloseTo(0, 6);
    expect(peakIndex(response)).toBe(240);
    expect((peakIndex(response) / SAMPLE_RATE) * 1000).toBeCloseTo(5, 6);
  });

  test("the peak of a stretch of signal is read between two times", () => {
    const signal = new Float32Array(SAMPLE_RATE);
    signal[SAMPLE_RATE / 2] = 0.5;
    expect(peakDb(signal, 0.4, 0.6)).toBeCloseTo(-6.0206, 3);
    expect(peakDb(signal, 0, 0.4)).toBeLessThan(-200);
  });

  test("the reverberation time of an exponential decay is the time it takes to fall 60 dB", () => {
    const seconds = 1.5;
    const length = Math.round(SAMPLE_RATE * seconds * 1.6);
    // A deterministic noise under an envelope that falls 60 dB in 1.5 s.
    let seed = 7;
    const response = Float32Array.from({ length }, (_, index) => {
      seed = (seed * 16_807) % 2_147_483_647;
      const noise = (seed / 2_147_483_647) * 2 - 1;
      return noise * 10 ** ((-60 * (index / SAMPLE_RATE / seconds)) / 20);
    });
    expect(reverberationTime(response)).toBeCloseTo(seconds, 1);
  });
});
