import { describe, expect, test } from "bun:test";
import {
  LOUDNESS_TARGETS,
  loudnessGain,
  measureLoudness,
} from "@/registry-audio/bases/base/lib/loudness";

const RATE = 48_000;

/** A stereo sine at `hz`, its peak at `dbfs`, in passages of `seconds` each. */
function sine(hz: number, passages: [dbfs: number, seconds: number][]) {
  const frames = passages.reduce((sum, [, seconds]) => sum + seconds * RATE, 0);
  const channel = new Float32Array(frames);
  let frame = 0;
  for (const [dbfs, seconds] of passages) {
    const amplitude = 10 ** (dbfs / 20);
    for (const end = frame + seconds * RATE; frame < end; frame += 1) {
      channel[frame] = amplitude * Math.sin((2 * Math.PI * hz * frame) / RATE);
    }
  }
  return [channel, channel.slice()];
}

describe("measureLoudness", () => {
  test("a stereo sine of 1 kHz reads as loud in LUFS as its peak in dBFS (EBU Tech 3341, cases 1 and 2)", () => {
    expect(measureLoudness(sine(1000, [[-23, 20]]), RATE).lufs).toBeCloseTo(
      -23,
      1
    );
    expect(measureLoudness(sine(1000, [[-33, 20]]), RATE).lufs).toBeCloseTo(
      -33,
      1
    );
  });

  test("the gates leave the quiet passages out", () => {
    const loudness = measureLoudness(
      sine(1000, [
        [-72, 10],
        [-36, 10],
        [-23, 60],
        [-36, 10],
        [-72, 10],
      ]),
      RATE
    );
    expect(loudness.lufs).toBeCloseTo(-23, 1);
  });

  test("the true peak reads between the samples", () => {
    // A sine at a quarter of the rate, a quarter turn off its samples: they all land at 0.707 of its peak.
    // It fades in and out over 0.1 s: cut off hard, a waveform rings past its peak at the cut.
    const fade = RATE / 10;
    const channel = Float32Array.from({ length: RATE }, (_, frame) => {
      const edge = Math.min(1, frame / fade, (RATE - 1 - frame) / fade);
      const level = 0.5 * Math.sin((Math.PI / 2) * edge) ** 2;
      return level * Math.sin((Math.PI * frame) / 2 + Math.PI / 4);
    });
    const loudness = measureLoudness([channel], RATE);
    expect(loudness.peak).toBeCloseTo(-9.03, 1);
    expect(loudness.truePeak).toBeCloseTo(-6.02, 1);
  });

  test("silence is -Infinity throughout", () => {
    expect(measureLoudness([new Float32Array(RATE)], RATE)).toEqual({
      lufs: Number.NEGATIVE_INFINITY,
      peak: Number.NEGATIVE_INFINITY,
      truePeak: Number.NEGATIVE_INFINITY,
    });
    expect(measureLoudness([], RATE).lufs).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("loudnessGain", () => {
  test("brings a sound to its target where the peaks allow it", () => {
    expect(
      loudnessGain(
        { lufs: -23, peak: -12, truePeak: -11.5 },
        LOUDNESS_TARGETS.streaming
      )
    ).toBe(9);
  });

  test("stops where the true peak would pass the ceiling", () => {
    expect(loudnessGain({ lufs: -20, peak: -4, truePeak: -3 }, -14)).toBe(2);
    expect(loudnessGain({ lufs: -20, peak: -4, truePeak: -3 }, -14, -2)).toBe(
      1
    );
  });

  test("turns a sound down to its target, and leaves silence alone", () => {
    expect(loudnessGain({ lufs: -8, peak: 0, truePeak: 0.5 }, -14)).toBe(-6);
    expect(
      loudnessGain(
        {
          lufs: Number.NEGATIVE_INFINITY,
          peak: Number.NEGATIVE_INFINITY,
          truePeak: Number.NEGATIVE_INFINITY,
        },
        -14
      )
    ).toBe(0);
  });
});
