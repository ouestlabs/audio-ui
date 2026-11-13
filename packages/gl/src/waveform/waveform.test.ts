import { describe, expect, test } from "bun:test";
import {
  LEAF_FRAMES,
  leavesPeak,
  splitsChannels,
  type WaveformClip,
  waveformLeaves,
  waveformRows,
} from "./index.ts";

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

describe("waveformLeaves", () => {
  test("each leaf is the lowest, the highest, the sum of squares and the count of its 256 frames", () => {
    const signal = Float32Array.from({ length: 600 }, (_, index) =>
      Math.sin(index / 7)
    );
    const leaves = waveformLeaves(signal);
    expect(leaves).toHaveLength(12);
    for (let leaf = 0; leaf < 3; leaf += 1) {
      const part = Array.from(
        signal.subarray(leaf * LEAF_FRAMES, (leaf + 1) * LEAF_FRAMES)
      );
      expect(leaves[leaf * 4]).toBeCloseTo(Math.min(...part), 6);
      expect(leaves[leaf * 4 + 1]).toBeCloseTo(Math.max(...part), 6);
      expect(leaves[leaf * 4 + 2]).toBeCloseTo(
        part.reduce((sum, value) => sum + value * value, 0),
        3
      );
      expect(leaves[leaf * 4 + 3]).toBe(part.length);
    }
    expect(leaves[11]).toBe(600 - 2 * LEAF_FRAMES);
  });

  test("NaN is left out, and a leaf of nothing else is empty", () => {
    const signal = new Float32Array(512).fill(Number.NaN);
    signal[300] = -0.5;
    const leaves = Array.from(waveformLeaves(signal));
    expect(leaves.slice(0, 4)).toEqual([
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      0,
      0,
    ]);
    expect(leaves.slice(4)).toEqual([-0.5, -0.5, 0.25, 1]);
  });

  test("the leaves of stretches laid end to end are the leaves of the whole", () => {
    const signal = Float32Array.from({ length: 2000 }, (_, index) =>
      Math.cos(index)
    );
    const head = waveformLeaves(signal.subarray(0, 1024));
    const tail = waveformLeaves(signal.subarray(1024));
    const joined = new Float32Array(head.length + tail.length);
    joined.set(head);
    joined.set(tail, head.length);
    expect(joined).toEqual(waveformLeaves(signal));
  });
});

describe("leavesPeak", () => {
  test("the loudest sample of the leaves that hold some", () => {
    const signal = new Float32Array(1024);
    signal[10] = 0.3;
    signal[700] = -0.8;
    const leaves = waveformLeaves(signal);
    expect(leavesPeak(leaves)).toBeCloseTo(0.8, 6);
    expect(
      leavesPeak(waveformLeaves(new Float32Array(256).fill(Number.NaN)))
    ).toBe(0);
  });
});

describe("waveformRows with streamed bands", () => {
  test("a band that is a reader is a row of its own, laid out as one at hand", () => {
    const reader = { frames: 100, leaves: () => [], read: () => [] };
    const bands = () => ({ high: reader, low: reader, mid: reader });
    const rows = waveformRows(clip(2, { bands }), mix, null, "bands", 60);
    expect(rows.map((row) => [row.key, row.layer, row.y, row.h])).toEqual([
      ["rec:low", "low", 0, 60],
      ["rec:mid", "mid", 0, 60],
      ["rec:high", "high", 0, 60],
    ]);
  });
});
