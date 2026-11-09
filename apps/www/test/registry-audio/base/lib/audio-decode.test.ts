import { describe, expect, test } from "bun:test";
import encode from "@audio/encode";
import {
  decodeAudioChannels,
  decodeAudioSamples,
} from "@/registry-audio/bases/base/lib/audio-decode";

/** What the browser says of bytes it cannot decode. */
const REFUSED = new Error("EncodingError: Unable to decode audio data");

/** A context whose own decoder refuses everything, as Chrome's does an AIFF. */
const refusing = (sampleRate: number) =>
  ({
    decodeAudioData: () => Promise.reject(REFUSED),
    sampleRate,
  }) as unknown as BaseAudioContext;

/** One second of a 440 Hz sine at `rate`, at half scale. */
const sine = (rate: number, length = rate) =>
  Float32Array.from(
    { length },
    (_, frame) => 0.5 * Math.sin((2 * Math.PI * 440 * frame) / rate)
  );

/** The largest gap between two runs of samples over `[from, to)`. */
function largestError(
  a: Float32Array,
  b: Float32Array,
  from = 0,
  to = a.length
) {
  let error = 0;
  for (let frame = from; frame < to; frame += 1) {
    error = Math.max(error, Math.abs((a[frame] ?? 0) - (b[frame] ?? 0)));
  }
  return error;
}

const aiff = async (rate: number) =>
  (
    await encode.aiff([sine(rate), sine(rate)], {
      bitDepth: 16,
      sampleRate: rate,
    })
  ).slice().buffer;

describe("decodeAudioChannels", () => {
  test("a file the browser refuses is decoded, at the context's rate", async () => {
    const channels = await decodeAudioChannels(
      refusing(48_000),
      await aiff(44_100)
    );
    expect(channels).toHaveLength(2);
    expect(channels[0]).toHaveLength(48_000);
    // The same sine, now at 48 kHz: away from the edges, within the 16-bit steps and the resampler's ripple.
    expect(
      largestError(channels[0] as Float32Array, sine(48_000), 100, 47_900)
    ).toBeLessThan(2e-3);
  });

  test("a CAF and an Apple Lossless file are read the same way", async () => {
    const channels = [sine(44_100), sine(44_100)];
    const files = [
      await encode.caf(channels, { bitDepth: 16, sampleRate: 44_100 }),
      await encode.m4a(channels, { codec: "alac", sampleRate: 44_100 }),
    ];
    const decoded = await Promise.all(
      files.map((file) =>
        decodeAudioChannels(refusing(44_100), file.slice().buffer)
      )
    );
    for (const [left] of decoded) {
      expect(largestError(left as Float32Array, sine(44_100))).toBeLessThan(
        2 ** -15
      );
    }
  });

  test("at the context's own rate, the samples are the file's", async () => {
    const [left] = await decodeAudioChannels(
      refusing(44_100),
      await aiff(44_100)
    );
    expect(left).toHaveLength(44_100);
    expect(largestError(left as Float32Array, sine(44_100))).toBeLessThan(
      2 ** -15
    );
  });

  test("bytes that are not sound reject with the browser's own error", async () => {
    const noise = Uint8Array.from({ length: 4096 }, (_, index) => index % 251);
    await expect(
      decodeAudioChannels(refusing(48_000), noise.buffer)
    ).rejects.toBe(REFUSED);
  });

  test("a file the browser reads comes from its decoder", async () => {
    const left = sine(48_000, 4);
    const right = sine(48_000, 4).map((sample) => -sample);
    const context = {
      decodeAudioData: () =>
        Promise.resolve({
          getChannelData: (channel: number) => (channel === 0 ? left : right),
          numberOfChannels: 2,
        }),
      sampleRate: 48_000,
    } as unknown as BaseAudioContext;
    expect(await decodeAudioChannels(context, new ArrayBuffer(8))).toEqual([
      left,
      right,
    ]);
    expect(await decodeAudioSamples(context, new ArrayBuffer(8), 5)).toBe(
      right
    );
  });
});
