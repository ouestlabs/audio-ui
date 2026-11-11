import { describe, expect, test } from "bun:test";
import decodeWav from "@audio/decode-wav";
import { measureLoudness, peakDb } from "@audio-ui/engine/analysis";
import {
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  type ExportStage,
  exportSound,
} from "@/registry-audio/bases/base/lib/audio-export";

const RATE = 48_000;
/** A float WAV, so the gain reads back exactly. */
const FLOAT: ExportSettings = { ...DEFAULT_EXPORT_SETTINGS, bitDepth: 32 };

/** Four seconds of a stereo 1 kHz sine, its peak at `dbfs`. */
function tone(dbfs: number): [Float32Array, Float32Array] {
  const amplitude = 10 ** (dbfs / 20);
  const channel = Float32Array.from(
    { length: RATE * 4 },
    (_, frame) => amplitude * Math.sin((2 * Math.PI * 1000 * frame) / RATE)
  );
  return [channel, channel.slice()];
}

const decoded = async (file: Blob) =>
  decodeWav(new Uint8Array(await file.arrayBuffer())).channelData;

describe("exportSound", () => {
  test("EXP-001: left at its level, the file holds the render as it is, and says how loud it is", async () => {
    const channels = tone(-20);
    const exported = await exportSound(channels, RATE, FLOAT);
    expect(exported.gain).toBe(0);
    expect([...((await decoded(exported.file))[0] ?? [])]).toEqual([
      ...channels[0],
    ]);
    expect(exported.loudness.lufs).toBeCloseTo(-20, 1);
  });

  test("EXP-005: normalized to its peak, the loudest sample reaches 0 dBFS", async () => {
    const exported = await exportSound(tone(-12), RATE, {
      ...FLOAT,
      normalize: "peak",
    });
    expect(exported.gain).toBeCloseTo(12, 3);
    const [left] = await decoded(exported.file);
    expect(peakDb(left as Float32Array)).toBeCloseTo(0, 3);
    expect(exported.loudness.peak).toBeCloseTo(0, 3);
  });

  test("normalized to a loudness, the file reads it, its true peak under the ceiling", async () => {
    const exported = await exportSound(tone(-30), RATE, {
      ...FLOAT,
      normalize: -14,
    });
    const back = measureLoudness(await decoded(exported.file), RATE);
    expect(back.lufs).toBeCloseTo(-14, 1);
    expect(exported.loudness.lufs).toBeCloseTo(back.lufs, 2);
    expect(back.truePeak).toBeLessThanOrEqual(-1);
  });

  test("a loud sound stops at the ceiling, under its target", async () => {
    // A stereo sine's true peak is as high as its loudness: at -0.5 LUFS it would pass -1 dBTP.
    const exported = await exportSound(tone(-20), RATE, {
      ...FLOAT,
      normalize: -0.5,
    });
    expect(exported.loudness.truePeak).toBeCloseTo(-1, 2);
    expect(exported.loudness.lufs).toBeLessThan(-0.5);
  });

  test("says what it is doing: measuring, then encoding to the end", async () => {
    const stages: [ExportStage, number][] = [];
    await exportSound(tone(-20), RATE, FLOAT, (stage, done) =>
      stages.push([stage, done])
    );
    expect(stages[0]).toEqual(["measuring", 0]);
    expect(stages.at(-1)).toEqual(["encoding", 1]);
  });
});
