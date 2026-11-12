import { describe, expect, test } from "bun:test";
import { spectrogram } from "./spectrogram.ts";

const RATE = 16_000;
const sine = (frequency: number, amplitude: number, seconds = 1) =>
  Float32Array.from(
    { length: RATE * seconds },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / RATE)
  );
/** The bin each frame's loudest bin falls on, over the middle of the grid. */
const loudestBin = (grid: ReturnType<typeof spectrogram>, frame: number) => {
  let best = 0;
  for (let bin = 1; bin < grid.bins; bin += 1) {
    if (
      (grid.levels[frame * grid.bins + bin] as number) >
      (grid.levels[frame * grid.bins + best] as number)
    ) {
      best = bin;
    }
  }
  return best;
};

describe("spectrogram", () => {
  test("a sine stands on its own bin in every frame", () => {
    const grid = spectrogram([sine(2000, 1)], RATE);
    const middle = Math.floor(grid.frames / 2);
    expect(loudestBin(grid, middle) * grid.hertzPerBin).toBeCloseTo(2000, -2);
    expect(grid.bins).toBe(513);
  });

  test("a full-scale sine reads near the top of the range, a quiet one lower", () => {
    const loud = spectrogram([sine(2000, 1)], RATE);
    const quiet = spectrogram([sine(2000, 0.01)], RATE);
    const at = (grid: ReturnType<typeof spectrogram>) => {
      const frame = Math.floor(grid.frames / 2);
      return grid.levels[frame * grid.bins + loudestBin(grid, frame)] as number;
    };
    expect(at(loud)).toBeGreaterThan(240);
    expect(at(quiet)).toBeLessThan(at(loud) - 60);
  });

  test("the grid is as long as the sound needs, one hop apart", () => {
    const grid = spectrogram([sine(440, 0.5, 2)], RATE);
    expect(grid.hop).toBeCloseTo(256 / RATE, 6);
    expect(grid.frames * grid.hop).toBeGreaterThan(1.9);
    expect(grid.levels.length).toBe(grid.frames * grid.bins);
  });

  test("silence is the floor", () => {
    const grid = spectrogram([new Float32Array(RATE)], RATE);
    expect(Math.max(...grid.levels)).toBe(0);
  });
});
