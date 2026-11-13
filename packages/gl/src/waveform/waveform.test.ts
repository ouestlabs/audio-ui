import { describe, expect, test } from "bun:test";
import { splitsChannels, type WaveformClip, waveformRows } from "./index.ts";

const samples = (frames: number) => ({
  frames,
  read: () => new Float32Array(frames),
});
const mix = new Float32Array(100);

const clip = (
  channels?: number,
  extra: Partial<WaveformClip> = {}
): WaveformClip => ({
  channels: channels
    ? Array.from({ length: channels }, () => samples(100))
    : undefined,
  gain: 1,
  id: "c",
  length: 1,
  peak: 0.5,
  sampleRate: 1000,
  samples: samples(100),
  segments: () => [],
  source: "rec",
  start: 0,
  ...extra,
});

describe("splitsChannels", () => {
  test("auto splits a stereo clip once each row is tall enough, and mixes below", () => {
    expect(splitsChannels(clip(2), "auto", "plain", 80)).toBe(true);
    expect(splitsChannels(clip(2), "auto", "plain", 79)).toBe(false);
    expect(splitsChannels(clip(6), "auto", "plain", 240)).toBe(true);
    expect(splitsChannels(clip(6), "auto", "plain", 239)).toBe(false);
  });

  test("split and mix are forced, a mono clip never splits, the band look draws the mix", () => {
    expect(splitsChannels(clip(2), "split", "plain", 10)).toBe(true);
    expect(splitsChannels(clip(2), "mix", "plain", 400)).toBe(false);
    expect(splitsChannels(clip(), "split", "plain", 400)).toBe(false);
    expect(splitsChannels(clip(1), "split", "plain", 400)).toBe(false);
    expect(splitsChannels(clip(2), "split", "bands", 400)).toBe(false);
  });
});

describe("waveformRows", () => {
  test("a clip drawn whole is one row the height of the lane", () => {
    const rows = waveformRows(clip(2), mix, null, "plain", 90);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      h: 90,
      key: "rec:plain",
      layer: "plain",
      y: 0,
    });
  });

  test("channels are rows of an equal share, each on its own key, at the clip's peak", () => {
    const rows = waveformRows(clip(2), mix, [mix, mix], "plain", 100);
    expect(rows.map((row) => [row.key, row.y, row.h, row.peak])).toEqual([
      ["rec:channel0", 0, 50, 0.5],
      ["rec:channel1", 50, 50, 0.5],
    ]);
  });

  test("the band look is three layers of the whole lane, each at its own loudest", () => {
    const bands = () => ({
      high: new Float32Array(1),
      low: new Float32Array(1),
      mid: new Float32Array(1),
      peaks: { high: 0.1, low: 0.4, mid: 0.8 },
    });
    const rows = waveformRows(clip(2, { bands }), mix, null, "bands", 60);
    expect(rows.map((row) => [row.layer, row.peak, row.y, row.h])).toEqual([
      ["low", 0.4, 0, 60],
      ["mid", 0.8, 0, 60],
      ["high", 0.1, 0, 60],
    ]);
  });
});
