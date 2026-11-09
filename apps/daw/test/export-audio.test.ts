import { describe, expect, test } from "bun:test";
import decodeFlac from "@audio/decode-flac";
import decodeMp3 from "@audio/decode-mp3";
import { rmsDb } from "@audio-ui/core/analysis";
import {
  EXPORT_OPTIONS,
  type ExportFormat,
  encodeAudio,
} from "@/lib/daw/export-audio";

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

const bytesOf = async (file: Blob) => new Uint8Array(await file.arrayBuffer());

/** What the export writes for `format`. */
const exported = (
  channels: Float32Array[],
  sampleRate: number,
  format: ExportFormat,
  onProgress?: (done: number) => void
) =>
  encodeAudio(
    channels,
    format,
    { ...EXPORT_OPTIONS[format], sampleRate },
    onProgress
  );

describe("EXP-003: the file", () => {
  test("a FLAC holds every sample at 24 bits, and says how far the encoding is", async () => {
    const channels = tones(48_000);
    const progress: number[] = [];
    const file = await exported(channels, 48_000, "flac", (done) =>
      progress.push(done)
    );
    expect(file.type).toBe("audio/flac");
    const decoded = await decodeFlac(await bytesOf(file));
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.channelData).toHaveLength(2);
    for (const [index, channel] of channels.entries()) {
      const back = decoded.channelData[index] as Float32Array;
      expect(back).toHaveLength(channel.length);
      let error = 0;
      for (const [frame, sample] of channel.entries()) {
        error = Math.max(error, Math.abs((back[frame] ?? 0) - sample));
      }
      // Within half a step of 24 bits: the nearest step, every time.
      expect(error).toBeLessThanOrEqual(2 ** -24);
    }
    expect(progress).toEqual([0.4, 0.8, 1]);
  });

  test("an MP3 is at 320 kbps, as long as the render and as loud", async () => {
    const [left, right] = tones(48_000);
    const file = await exported([left, right], 48_000, "mp3");
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

  test("an MP3 of a 96 kHz project comes out at 48 kHz", async () => {
    const file = await exported(tones(96_000), 96_000, "mp3");
    const decoded = await decodeMp3(await bytesOf(file));
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.channelData[0]).toHaveLength(48_000 * 5);
  });

  test("a WAV is 24-bit stereo at the project's rate", async () => {
    const file = await exported(tones(44_100), 44_100, "wav");
    expect(file.type).toBe("audio/wav");
    const view = new DataView(await file.arrayBuffer());
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getUint16(34, true)).toBe(24);
  });
});
