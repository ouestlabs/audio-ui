import { describe, expect, test } from "bun:test";
import {
  downsampleWaveform,
  normalizeWaveform,
  waveformBars,
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

describe("waveformBars", () => {
  test("returns [] for no values", () => {
    expect(waveformBars([])).toEqual([]);
  });

  test("lays out a full-amplitude bar across the whole canvas", () => {
    const [bar] = waveformBars([1], { gap: 0, height: 100, width: 100 });
    expect(bar).toEqual({ height: 100, opacity: 1, width: 100, x: 0, y: 0 });
  });

  test("floors bar height and opacity for a silent sample, centering it", () => {
    // MIN_BAR_HEIGHT_RATIO 0.02 -> height 2 ; MIN_OPACITY 0.3 ; centered y
    const [bar] = waveformBars([0], { gap: 0, height: 100, width: 100 });
    expect(bar).toEqual({ height: 2, opacity: 0.3, width: 100, x: 0, y: 49 });
  });

  test("insets each bar by the gap and steps evenly across the width", () => {
    // step 50, barWidth 50*0.75=37.5, inset (50-37.5)/2 = 6.25
    const bars = waveformBars([1, 1], { gap: 0.25, height: 100, width: 100 });
    expect(bars.map((b) => b.x)).toEqual([6.25, 56.25]);
    expect(bars[0]?.width).toBe(37.5);
  });
});
