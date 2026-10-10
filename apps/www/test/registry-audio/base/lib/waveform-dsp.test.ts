import { describe, expect, test } from "bun:test";
import {
  downsampleWaveform,
  normalizeWaveform,
} from "@/registry-audio/bases/base/lib/waveform-dsp";

describe("downsampleWaveform", () => {
  test("returns [] for empty input or non-positive target", () => {
    expect(downsampleWaveform([], 8)).toEqual([]);
    expect(downsampleWaveform([1, 2, 3], 0)).toEqual([]);
  });

  test("reduces to targetLength blocks using each block's peak absolute value", () => {
    // two blocks of 3: peak(|0|,|0.5|,|-0.8|)=0.8 ; peak(|0.2|,|0.1|,|0.3|)=0.3
    const samples = [0, 0.5, -0.8, 0.2, 0.1, 0.3];
    expect(downsampleWaveform(samples, 2)).toEqual([0.8, 0.3]);
  });

  test("pads with zeros when target exceeds the sample count", () => {
    expect(downsampleWaveform([1, -1], 4)).toEqual([1, 1, 0, 0]);
  });
});

describe("normalizeWaveform", () => {
  test("scales so the largest entry becomes 1", () => {
    expect(normalizeWaveform([0.2, 0.4, 0.1])).toEqual([0.5, 1, 0.25]);
  });

  test("maps all-zero input to zeros (no divide-by-zero)", () => {
    expect(normalizeWaveform([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
