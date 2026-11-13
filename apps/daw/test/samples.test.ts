import { describe, expect, test } from "bun:test";
import { leavesPeak, waveformLeaves } from "@audio-ui/gl/waveform";
import {
  makeLeaves,
  recordingBands,
  recordingChannels,
  recordingSamples,
} from "@/lib/daw/samples";

describe("a recording's samples for the clip view (CLP-024)", () => {
  test("reads the middle of its channels, only the frames asked for", async () => {
    const source = {
      channels: [
        new Float32Array([0, 1, 0.5, -1]),
        new Float32Array([0, 0, 0.5, 1]),
      ],
      sampleRate: 48_000,
    };
    const samples = recordingSamples(source);
    expect(samples.frames).toBe(4);
    expect(Array.from(await samples.read(1, 4))).toEqual([0.5, 0.5, 0]);
  });

  test("a mono recording reads as it is", async () => {
    const samples = recordingSamples({
      channels: [new Float32Array([0.25, -0.75])],
      sampleRate: 44_100,
    });
    expect(Array.from(await samples.read(0, 2))).toEqual([0.25, -0.75]);
  });

  test("the same source gives the same reader, so a view does not draw again for nothing", () => {
    const source = { channels: [new Float32Array(8)], sampleRate: 44_100 };
    expect(recordingSamples(source)).toBe(recordingSamples(source));
  });
});

describe("a recording's channels and bands for the clip view (CLP-025, CLP-026)", () => {
  test("a stereo recording reads each channel alone, a mono one has none", async () => {
    const source = {
      channels: [new Float32Array([0, 1, 0.5]), new Float32Array([1, 0, 0.5])],
      sampleRate: 48_000,
    };
    const channels = recordingChannels(source);
    expect(channels).toHaveLength(2);
    expect(Array.from(await (channels?.[1]?.read(0, 3) ?? []))).toEqual([
      1, 0, 0.5,
    ]);
    expect(recordingChannels(source)).toBe(channels);
    expect(
      recordingChannels({ channels: [new Float32Array(4)], sampleRate: 48_000 })
    ).toBeUndefined();
  });

  test("a recording held in memory is split in its three bands once", () => {
    const source = {
      channels: [Float32Array.from({ length: 4800 }, (_, i) => Math.sin(i))],
      sampleRate: 48_000,
    };
    const bands = recordingBands(source);
    expect(bands()).toBe(bands());
    expect(bands().low).toHaveLength(4800);
  });

  test("leaves are kept mix first, then each channel, then the three bands", async () => {
    const left = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7));
    const right = Float32Array.from({ length: 1000 }, () => 0.25);
    const leaves = await makeLeaves(2, 1000, 48_000, (from, to) => [
      left.subarray(from, to),
      right.subarray(from, to),
    ]);
    const size = Math.ceil(1000 / 256) * 4;
    expect(leaves).toHaveLength(size * 6);
    expect(leaves.subarray(size, 2 * size)).toEqual(waveformLeaves(left));
    expect(leavesPeak(leaves.subarray(2 * size, 3 * size))).toBeCloseTo(
      0.25,
      6
    );
    // The bands of a mix add back to it: none is louder than the mix can reach.
    for (let band = 3; band < 6; band += 1) {
      expect(
        leavesPeak(leaves.subarray(band * size, (band + 1) * size))
      ).toBeLessThan(1.5);
    }
  });
});
