import { describe, expect, test } from "bun:test";
import {
  DEMO_SOURCES,
  pinkNoise,
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
      "groove",
      "kick",
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
