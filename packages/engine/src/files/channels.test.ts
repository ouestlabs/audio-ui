import { describe, expect, test } from "bun:test";
import {
  mixChannels,
  padChannels,
  repeatChannels,
  resampleChannels,
  reverseChannels,
} from "./channels.ts";

const tone = (length: number, value: number) =>
  new Float32Array(length).fill(value);
const peakOf = (channel: Float32Array) =>
  Math.max(...channel.map((sample) => Math.abs(sample)));

describe("mixChannels", () => {
  test("a layout the sound already has comes back as it is", () => {
    const stereo = [tone(8, 0.5), tone(8, -0.5)];
    expect(mixChannels(stereo, "stereo")).toEqual(stereo);
  });

  test("stereo to mono is the average of the sides", () => {
    const [mono] = mixChannels([tone(4, 0.8), tone(4, 0.2)], "mono");
    expect([...(mono ?? [])].map((sample) => Math.round(sample * 100))).toEqual(
      [50, 50, 50, 50]
    );
  });

  test("mono to stereo is the same signal on both sides", () => {
    const [left, right] = mixChannels([tone(4, 0.6)], "stereo");
    expect(left).toEqual(right);
    expect(peakOf(left ?? new Float32Array())).toBeCloseTo(0.6, 5);
  });

  test("a 5.1 down-mixed never passes full scale, and drops the low-frequency channel", () => {
    const full = [1, 1, 1, 1, 1, 1].map((value) => tone(4, value));
    const stereo = mixChannels(full, "stereo");
    expect(stereo).toHaveLength(2);
    expect(peakOf(stereo[0] ?? new Float32Array())).toBeLessThanOrEqual(1.0001);
    const lfeOnly = [0, 0, 0, 1, 0, 0].map((value) => tone(4, value));
    expect(
      peakOf(mixChannels(lfeOnly, "stereo")[0] ?? new Float32Array())
    ).toBe(0);
  });

  test("stereo up to 5.1 and 7.1 has the right count, the sides kept, the centre silent", () => {
    const stereo = [tone(4, 0.4), tone(4, 0.2)];
    const five = mixChannels(stereo, "5.1");
    expect(five).toHaveLength(6);
    expect(five[0]).toEqual(stereo[0]);
    expect(five[1]).toEqual(stereo[1]);
    expect(peakOf(five[2] ?? new Float32Array())).toBe(0);
    expect(peakOf(five[4] ?? new Float32Array())).toBeCloseTo(0.2, 5);
    expect(mixChannels(stereo, "7.1")).toHaveLength(8);
  });
});

describe("resampleChannels", () => {
  test("the same rate comes back as it is", () => {
    const channels = [tone(10, 0.1)];
    expect(resampleChannels(channels, 48_000, 48_000)).toEqual(channels);
  });

  test("a rate halved halves the length, each channel", () => {
    const channels = [tone(480, 0.3), tone(480, 0.3)];
    const down = resampleChannels(channels, 48_000, 24_000);
    expect(down).toHaveLength(2);
    expect(Math.abs((down[0]?.length ?? 0) - 240)).toBeLessThanOrEqual(2);
  });
});

describe("reverseChannels", () => {
  test("plays each channel from its end, and leaves the source alone", () => {
    const source = Float32Array.of(1, 2, 3);
    const [reversed] = reverseChannels([source]);
    expect([...(reversed ?? [])]).toEqual([3, 2, 1]);
    expect([...source]).toEqual([1, 2, 3]);
  });
});

describe("repeatChannels", () => {
  test("puts the sound end to end the number of times asked", () => {
    const [out] = repeatChannels([Float32Array.of(1, 2)], 3);
    expect([...(out ?? [])]).toEqual([1, 2, 1, 2, 1, 2]);
  });

  test("fewer than one is the sound once", () => {
    const [out] = repeatChannels([Float32Array.of(1, 2)], 0);
    expect([...(out ?? [])]).toEqual([1, 2]);
  });
});

describe("padChannels", () => {
  test("adds silence before and after, on every channel", () => {
    const out = padChannels([Float32Array.of(1), Float32Array.of(2)], {
      after: 2,
      before: 1,
    });
    expect(out.map((channel) => [...channel])).toEqual([
      [0, 1, 0, 0],
      [0, 2, 0, 0],
    ]);
  });
});
