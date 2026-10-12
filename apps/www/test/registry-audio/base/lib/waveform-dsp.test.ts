import { describe, expect, test } from "bun:test";
import {
  computePeaks,
  downsampleWaveform,
  normalizePeaks,
  normalizeWaveform,
  spectrumBands,
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

describe("spectrumBands", () => {
  // 1024 bins at 48 kHz: 23.4375 Hz per bin
  const sampleRate = 48_000;
  const silence = () => new Float32Array(1024).fill(-100);
  const rounded = (bands: Float32Array) =>
    Array.from(bands, (band) => Math.round(band * 100) / 100);

  test("maps decibels onto 0-1 between minDb and maxDb", () => {
    const spectrum = new Float32Array(1024).fill(-65);
    expect(
      rounded(spectrumBands(spectrum, new Float32Array(3), { sampleRate }))
    ).toEqual([0.5, 0.5, 0.5]);
  });

  test("clamps levels to 0-1", () => {
    const loud = new Float32Array(1024).fill(0);
    const quiet = new Float32Array(1024).fill(-140);
    expect(
      rounded(spectrumBands(loud, new Float32Array(2), { sampleRate }))
    ).toEqual([1, 1]);
    expect(
      rounded(spectrumBands(quiet, new Float32Array(2), { sampleRate }))
    ).toEqual([0, 0]);
  });

  test("a tone lights the band its frequency falls in, low to high", () => {
    const options = { maxHz: 8000, minHz: 125, sampleRate };
    // 6 octaves from 125 Hz to 8 kHz, one per band: 125-250, 250-500, …
    const low = silence();
    low[Math.round(180 / 23.4375)] = -30;
    expect(rounded(spectrumBands(low, new Float32Array(6), options))).toEqual([
      1, 0, 0, 0, 0, 0,
    ]);

    const high = silence();
    high[Math.round(3000 / 23.4375)] = -30;
    expect(rounded(spectrumBands(high, new Float32Array(6), options))).toEqual([
      0, 0, 0, 0, 1, 0,
    ]);
  });

  test("a narrow low band still reads at least one bin", () => {
    const spectrum = silence();
    spectrum[2] = -30;
    const bands = spectrumBands(spectrum, new Float32Array(64), {
      sampleRate,
    });
    expect(Math.max(...bands)).toBe(1);
  });

  test("returns silence for an empty spectrum", () => {
    expect(
      rounded(spectrumBands([], new Float32Array([0.5, 0.5]), { sampleRate }))
    ).toEqual([0, 0]);
  });
});

describe("computePeaks", () => {
  const rounded = (values: Float32Array) =>
    Array.from(values, (value) => Math.round(value * 100) / 100);

  test("keeps each slice's lowest and highest sample", () => {
    const { max, min } = computePeaks([[0.1, -0.5, 0.8, 0.2, -0.1, 0.3]], 2);
    expect(rounded(max)).toEqual([0.8, 0.3]);
    expect(rounded(min)).toEqual([-0.5, -0.1]);
  });

  test("folds every channel in, so a hard-panned take still draws", () => {
    const left = [0, 0, 0, 0];
    const right = [0.6, -0.4, 0.2, -0.9];
    const { max, min } = computePeaks([left, right], 2);
    expect(rounded(max)).toEqual([0.6, 0.2]);
    expect(rounded(min)).toEqual([-0.4, -0.9]);
  });

  test("returns empty peaks for no audio or no slices", () => {
    expect(computePeaks([], 4).max.length).toBe(4);
    expect(computePeaks([[0.5]], 0).max.length).toBe(0);
  });
});

describe("normalizePeaks", () => {
  test("scales the loudest sample, either way, to full height", () => {
    const peaks = normalizePeaks({
      max: new Float32Array([0.25, 0.1]),
      min: new Float32Array([-0.5, -0.2]),
    });
    const rounded = (values: Float32Array) =>
      Array.from(values, (value) => Math.round(value * 100) / 100);
    expect(rounded(peaks.max)).toEqual([0.5, 0.2]);
    expect(rounded(peaks.min)).toEqual([-1, -0.4]);
  });

  test("leaves silence alone", () => {
    const silent = { max: new Float32Array(2), min: new Float32Array(2) };
    expect(normalizePeaks(silent)).toBe(silent);
  });
});
