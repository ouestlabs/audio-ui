import { describe, expect, test } from "bun:test";
import {
  audioTakeClip,
  blockPeak,
  midiTakeClip,
  overdubbed,
  sliceBlocks,
  takeFrames,
} from "@/registry-audio/bases/base/lib/recording";

const RATE = 48_000;

describe("recording", () => {
  test("REC-008: a take's frames come latency later on the clock than where it was played", () => {
    // Played from 10 s at clock frame 1000; the take from 12 s to 13 s, heard and played 20 ms late.
    expect(
      takeFrames({
        from: 12,
        latency: 0.02,
        playAt: 1000,
        playFrom: 10,
        sampleRate: RATE,
        to: 13,
      })
    ).toEqual([1000 + 2.02 * RATE, 1000 + 3.02 * RATE]);
  });

  test("REC-007: a take keeps the frames it spans, across blocks, silence where none came", () => {
    const block = (frame: number, value: number) => ({
      channels: [new Float32Array(4).fill(value)],
      frame,
    });
    const [left, right] = sliceBlocks(
      [block(0, 1), block(4, 2), block(12, 3)],
      [2, 14],
      2
    );
    expect([...(left ?? [])]).toEqual([1, 1, 2, 2, 2, 2, 0, 0, 0, 0, 3, 3]);
    // A mono input fills both channels.
    expect([...(right ?? [])]).toEqual([...(left ?? [])]);
  });

  test("REC-011: a block drawn live shows its loudest sample over its channels", () => {
    expect(
      blockPeak({
        channels: [Float32Array.of(0.1, -0.2), Float32Array.of(0.05, -0.7)],
        frame: 0,
      })
    ).toBeCloseTo(0.7, 6);
  });

  test("REC-007: an audio take is a clip from where it started, as long as it lasted, with edge fades", () => {
    const clip = audioTakeClip({
      id: "take-1",
      length: 3,
      name: "Audio 1",
      recording: "rec-1",
      start: 8,
      track: "track-1",
    });
    expect(clip.value).toEqual({
      fadeIn: 0.004,
      fadeOut: 0.004,
      length: 3,
      offset: 0,
      start: 8,
    });
    expect(clip.sourceLength).toBe(3);
  });

  test("REC-009: a MIDI take keeps each note where and as long as it was held, a held one to the take's end, quantized when asked", () => {
    const played = [
      { end: 4.4, pitch: 60, start: 4.06, velocity: 0.8 },
      { end: 5.2, pitch: 64, start: 4.53, velocity: 0.5 },
      { pitch: 67, start: 5.5, velocity: 1 },
      // Before the take: left out.
      { end: 3.9, pitch: 48, start: 3.5, velocity: 1 },
    ];
    const clip = midiTakeClip({
      from: 4,
      id: "midi-take",
      name: "MIDI",
      played,
      quantize: 0.25,
      to: 6,
      track: "track-3",
    });
    expect(clip.value).toEqual({
      fadeIn: 0,
      fadeOut: 0,
      length: 2,
      offset: 0,
      start: 4,
    });
    expect(
      clip.notes?.map((note) => [
        note.pitch,
        note.start,
        Number(note.length.toFixed(3)),
        note.velocity,
      ])
    ).toEqual([
      [60, 0, 0.34, 0.8],
      [64, 0.5, 0.67, 0.5],
      [67, 1.5, 0.5, 1],
    ]);
  });

  test("REC-009: Overdub adds a take's notes to the clip under it, in its source's time", () => {
    const clip = {
      id: "m",
      name: "MIDI",
      notes: [{ id: "n1", length: 0.5, pitch: 60, start: 1 }],
      sourceLength: 8,
      track: "track-3",
      value: { fadeIn: 0, fadeOut: 0, length: 4, offset: 2, start: 10 },
    };
    const next = overdubbed(
      clip,
      [{ end: 11.5, pitch: 72, start: 11, velocity: 0.9 }],
      { from: 10, to: 14 }
    );
    expect(next.notes?.map((note) => [note.pitch, note.start])).toEqual([
      [60, 1],
      // 11 s on the arrangement is 1 s into the clip, 3 s into its source.
      [72, 3],
    ]);
  });
});
