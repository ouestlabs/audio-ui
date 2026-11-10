import { describe, expect, test } from "bun:test";
import { recordingSamples } from "@/lib/daw/samples";

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
