import { describe, expect, test } from "bun:test";
import {
  DEMO_SOURCES,
  pinkNoise,
  pulses,
} from "@/registry-audio/bases/base/lib/demo-sound";

/** The part of a context that draws a buffer: a rate and `createBuffer`, enough for the sounds made of noise. */
function drawingContext(sampleRate: number) {
  return {
    createBuffer: (_channels: number, length: number, rate: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data, length, sampleRate: rate };
    },
    sampleRate,
  } as unknown as BaseAudioContext;
}

const peak = (data: Float32Array, from: number, to: number) =>
  data
    .slice(from, to)
    .reduce((top, value) => Math.max(top, Math.abs(value)), 0);

describe("DEMO_SOURCES", () => {
  test("names every sound the previews play", () => {
    expect(Object.keys(DEMO_SOURCES).sort()).toEqual([
      "chord",
      "crank",
      "crankKick",
      "groove",
      "hiphop",
      "hiphopKick",
      "kick",
      "noise",
      "pulses",
      "voice",
      "wide",
    ]);
  });

  test("says what each one is and what to listen for", () => {
    for (const [name, source] of Object.entries(DEMO_SOURCES)) {
      expect(source.title.length, name).toBeGreaterThan(2);
      expect(source.about.endsWith("."), name).toBe(true);
      expect(source.about.includes("—"), name).toBe(false);
    }
  });
});

describe("pulses", () => {
  test("is two seconds of eight bursts, every other one quieter", () => {
    const rate = 8000;
    const data = (
      pulses(drawingContext(rate)) as unknown as {
        getChannelData: () => Float32Array;
      }
    ).getChannelData();
    expect(data.length).toBe(rate * 2);
    const burst = data.length / 8;
    expect(peak(data, 0, burst)).toBeGreaterThan(peak(data, burst, burst * 2));
    expect(peak(data, 0, data.length)).toBeLessThanOrEqual(1);
  });

  test("scales with its level", () => {
    const rate = 8000;
    const read = (level: number) =>
      (
        pulses(drawingContext(rate), level) as unknown as {
          getChannelData: () => Float32Array;
        }
      ).getChannelData();
    expect(peak(read(0.5), 0, 1000)).toBeLessThanOrEqual(0.5);
  });
});

describe("pinkNoise", () => {
  test("is four seconds of finite, moving samples", () => {
    const rate = 4000;
    const data = (
      pinkNoise(drawingContext(rate)) as unknown as {
        getChannelData: () => Float32Array;
      }
    ).getChannelData();
    expect(data.length).toBe(rate * 4);
    expect(data.every(Number.isFinite)).toBe(true);
    expect(peak(data, 0, data.length)).toBeGreaterThan(0.01);
  });
});
