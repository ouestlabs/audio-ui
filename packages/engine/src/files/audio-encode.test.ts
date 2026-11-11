import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import decodeFlac from "@audio/decode-flac";
import decodeMp3 from "@audio/decode-mp3";
import decodeWav from "@audio/decode-wav";
import { rmsDb } from "../analysis/index.ts";
import { encodeAudio } from "./audio-encode.ts";

/** Five seconds of two tones, one per side: more than two chunks, the last one short. */
function tones(sampleRate: number): [Float32Array, Float32Array] {
  const frames = sampleRate * 5;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    left[frame] = 0.5 * Math.sin((2 * Math.PI * 440 * frame) / sampleRate);
    right[frame] = -0.25 * Math.sin((2 * Math.PI * 660 * frame) / sampleRate);
  }
  return [left, right];
}

// The MP3 encoder loads its WebAssembly with `instantiateStreaming(fetch(...))`, and the runtime refuses the
// page's own `Response` the other tests run with: read the module's bytes from it instead, for these tests only.
const { instantiateStreaming } = WebAssembly;
beforeAll(() => {
  WebAssembly.instantiateStreaming = async (source, imports) =>
    WebAssembly.instantiate(await (await source).arrayBuffer(), imports);
});
afterAll(() => {
  WebAssembly.instantiateStreaming = instantiateStreaming;
});

const bytesOf = async (file: Blob) => new Uint8Array(await file.arrayBuffer());

/** The largest gap between two runs of samples. */
function largestError(a: Float32Array, b: Float32Array) {
  let error = 0;
  for (const [index, sample] of a.entries()) {
    error = Math.max(error, Math.abs((b[index] ?? 0) - sample));
  }
  return error;
}

describe("a WAV", () => {
  test("interleaves the channels at 16 bits and clips past full scale", async () => {
    const file = await encodeAudio(
      [Float32Array.of(1, -1, 0.5), Float32Array.of(-2, 2, 0)],
      { format: "wav", sampleRate: 44_100 }
    );
    expect(file.type).toBe("audio/wav");
    const { channelData, sampleRate } = decodeWav(await bytesOf(file));
    expect(sampleRate).toBe(44_100);
    expect([...(channelData[0] ?? [])]).toEqual([32_767 / 32_768, -1, 0.5]);
    expect([...(channelData[1] ?? [])]).toEqual([-1, 32_767 / 32_768, 0]);
  });

  test("24 bits keep each sample to the nearest step", async () => {
    const [left] = tones(48_000);
    const file = await encodeAudio([left], {
      bitDepth: 24,
      format: "wav",
      sampleRate: 48_000,
    });
    const back = decodeWav(await bytesOf(file)).channelData[0] as Float32Array;
    expect(back).toHaveLength(left.length);
    expect(largestError(left, back)).toBeLessThanOrEqual(2 ** -24);
  });

  test("ARR-020: 32 bits are floats, and keep what goes past full scale", async () => {
    const file = await encodeAudio([Float32Array.of(0.25, 1.5, -2)], {
      bitDepth: 32,
      format: "wav",
      sampleRate: 48_000,
    });
    expect([...(decodeWav(await bytesOf(file)).channelData[0] ?? [])]).toEqual([
      0.25, 1.5, -2,
    ]);
  });
});

describe("EXP-003: a FLAC and an MP3", () => {
  test("a FLAC holds every sample at 24 bits, and says how far the encoding is", async () => {
    const channels = tones(48_000);
    const progress: number[] = [];
    const file = await encodeAudio(channels, {
      bitDepth: 24,
      format: "flac",
      onProgress: (done) => progress.push(done),
      sampleRate: 48_000,
    });
    expect(file.type).toBe("audio/flac");
    const decoded = await decodeFlac(await bytesOf(file));
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.channelData).toHaveLength(2);
    for (const [index, channel] of channels.entries()) {
      const back = decoded.channelData[index] as Float32Array;
      expect(back).toHaveLength(channel.length);
      // Within half a step of 24 bits: the nearest step, every time.
      expect(largestError(channel, back)).toBeLessThanOrEqual(2 ** -24);
    }
    expect(progress).toEqual([0.4, 0.8, 1]);
  });

  test("an MP3 is at its bitrate, as long as the sound and as loud", async () => {
    const [left, right] = tones(48_000);
    const file = await encodeAudio([left, right], {
      bitrate: 320,
      format: "mp3",
      sampleRate: 48_000,
    });
    expect(file.type).toBe("audio/mpeg");
    expect((file.size * 8) / 5 / 1000).toBeCloseTo(320, -1);
    const decoded = await decodeMp3(await bytesOf(file));
    expect(decoded.sampleRate).toBe(48_000);
    const [backLeft, backRight] = decoded.channelData as [
      Float32Array,
      Float32Array,
    ];
    expect(backLeft).toHaveLength(left.length);
    expect(rmsDb(backLeft)).toBeCloseTo(rmsDb(left), 1);
    expect(rmsDb(backRight)).toBeCloseTo(rmsDb(right), 1);
  });

  test("an MP3 of a 96 kHz sound comes out at 48 kHz", async () => {
    const file = await encodeAudio(tones(96_000), {
      bitrate: 320,
      format: "mp3",
      sampleRate: 96_000,
    });
    const decoded = await decodeMp3(await bytesOf(file));
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.channelData[0]).toHaveLength(48_000 * 5);
  });
});
