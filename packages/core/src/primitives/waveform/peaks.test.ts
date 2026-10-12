import { describe, expect, test } from "bun:test";
import { fitPeaks, peakMagnitudes } from "./peaks";

const envelopeOf = (bars: number) => ({
  high: new Float32Array(bars),
  low: new Float32Array(bars),
});
const rounded = (values: Float32Array) =>
  Array.from(values, (value) => Math.round(value * 100) / 100);

describe("fitPeaks", () => {
  test("a level per entry draws the same above and below the middle", () => {
    const { high, low } = fitPeaks([0.5, 1], 0, 1, envelopeOf(2));
    expect(rounded(high)).toEqual([0.5, 1]);
    expect(rounded(low)).toEqual([-0.5, -1]);
  });

  test("min and max per entry keep the waveform lopsided where it is", () => {
    const peaks = { max: [0.8, 0.2], min: [-0.1, -0.6] };
    const { high, low } = fitPeaks(peaks, 0, 1, envelopeOf(2));
    expect(rounded(high)).toEqual([0.8, 0.2]);
    expect(rounded(low)).toEqual([-0.1, -0.6]);
  });

  test("each bar keeps the highest and lowest of its slice", () => {
    const peaks = { max: [0.2, 0.9, 0.3, 0.1], min: [-0.7, -0.1, -0.2, -0.4] };
    const { high, low } = fitPeaks(peaks, 0, 1, envelopeOf(2));
    expect(rounded(high)).toEqual([0.9, 0.3]);
    expect(rounded(low)).toEqual([-0.7, -0.4]);
  });

  test("draws only the stretch it is given", () => {
    const peaks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    // The second half, over four bars
    expect(rounded(fitPeaks(peaks, 0.5, 1, envelopeOf(4)).high)).toEqual([
      0.5, 0.6, 0.7, 0.8,
    ]);
  });

  test("blends neighbouring entries when zoomed in past them", () => {
    const { high } = fitPeaks([0, 1], 0, 1, envelopeOf(4));
    expect(rounded(high)).toEqual([0, 0.25, 0.75, 1]);
  });

  test("is silent outside the data and for empty data", () => {
    expect(rounded(fitPeaks([0.5, 0.5], 1, 1.5, envelopeOf(2)).high)).toEqual([
      0, 0,
    ]);
    expect(rounded(fitPeaks([], 0, 1, envelopeOf(2)).high)).toEqual([0, 0]);
  });

  test("keeps samples within -1…1", () => {
    const { high, low } = fitPeaks(
      { max: [3], min: [-4] },
      0,
      1,
      envelopeOf(1)
    );
    expect([high[0], low[0]]).toEqual([1, -1]);
  });
});

describe("peakMagnitudes", () => {
  test("is how far each slice reaches, either way", () => {
    const peaks = { max: [0.3, 0.2], min: [-0.1, -0.9] };
    expect(rounded(peakMagnitudes(peaks, 0, 1, 2))).toEqual([0.3, 0.9]);
  });
});
