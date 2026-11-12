import { describe, expect, test } from "bun:test";
import { detectSilences } from "./silence.ts";

const RATE = 48_000;

/** `seconds` of a 220 Hz tone at `gain`, with the stretches in `quiet` (seconds) left at `floor`. */
function phrases(
  seconds: number,
  quiet: readonly (readonly [number, number])[],
  gain = 0.5,
  floor = 0
) {
  const data = new Float32Array(Math.round(seconds * RATE));
  for (let index = 0; index < data.length; index += 1) {
    const time = index / RATE;
    const still = quiet.some(([from, to]) => time >= from && time < to);
    data[index] = (still ? floor : gain) * Math.sin(2 * Math.PI * 220 * time);
  }
  return data;
}

const near = (found: readonly (readonly [number, number])[]) =>
  found.map(([from, to]) => [
    Math.round(from * 100) / 100,
    Math.round(to * 100) / 100,
  ]);

describe("detectSilences", () => {
  test("finds the pauses between sounds, to a block of 1024 frames", () => {
    const data = phrases(3, [
      [0.5, 1],
      [2, 2.4],
    ]);
    expect(near(detectSilences([data], RATE))).toEqual([
      [0.51, 0.98],
      [2.01, 2.39],
    ]);
  });

  test("a pause shorter than 60 ms is no pause", () => {
    const data = phrases(1, [[0.4, 0.44]]);
    expect(detectSilences([data], RATE)).toEqual([]);
  });

  test("a quiet recording's pauses are under a tenth of its loudest", () => {
    // Its sound peaks at 0.01, under the ground of a loud one: its own floor is 20 dB under that.
    const data = phrases(2, [[0.8, 1.2]], 0.01, 0.0005);
    expect(near(detectSilences([data], RATE))).toEqual([[0.81, 1.19]]);
  });

  test("a pause is one in every channel, and a silent end runs to the end", () => {
    const left = phrases(2, [[1, 2]]);
    const right = phrases(2, [
      [0.2, 0.6],
      [1.5, 2],
    ]);
    expect(near(detectSilences([left, right], RATE))).toEqual([[1.51, 2]]);
  });

  test("a threshold of your own, in dBFS, and a shortest pause of your own", () => {
    const data = phrases(2, [[0.5, 0.6]], 0.5, 0.05);
    expect(detectSilences([data], RATE)).toEqual([]);
    expect(
      near(detectSilences([data], RATE, { minDuration: 0.05, threshold: -20 }))
    ).toEqual([[0.51, 0.6]]);
  });

  test("silence all through is one pause, and nothing is none", () => {
    expect(detectSilences([new Float32Array(RATE)], RATE)).toEqual([[0, 1]]);
    expect(detectSilences([], RATE)).toEqual([]);
  });
});
