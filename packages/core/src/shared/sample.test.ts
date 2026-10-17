import { describe, expect, test } from "bun:test";
import { adaptiveSamples } from "./sample.ts";

const grid = (count: number) =>
  Array.from({ length: count }, (_, index) => index / (count - 1));

/** The furthest the polyline is above or below the function, over a fine sweep. */
function worstStray(
  f: (t: number) => number,
  samples: ReturnType<typeof adaptiveSamples>
) {
  let worst = 0;
  for (let index = 0; index < samples.length - 1; index += 1) {
    const [from, start] = samples[index] ?? [0, 0];
    const [to, end] = samples[index + 1] ?? [1, 0];
    for (let step = 1; step < 20; step += 1) {
      const share = step / 20;
      const t = from + (to - from) * share;
      worst = Math.max(worst, Math.abs(f(t) - (start + (end - start) * share)));
    }
  }
  return worst;
}

describe("adaptiveSamples", () => {
  test("keeps a straight line to the vertices of the grid", () => {
    const samples = adaptiveSamples((t) => 2 * t, grid(5), 0.0005);
    expect(samples.map(([t]) => t)).toEqual(grid(5));
  });

  test("puts vertices at a corner the grid steps over", () => {
    const corner = (t: number) => (t < 0.43 ? t : 0.43 - 3 * (t - 0.43));
    const samples = adaptiveSamples(corner, grid(9), 0.0005);
    expect(samples.length).toBeGreaterThan(9);
    const nearest = Math.min(...samples.map(([t]) => Math.abs(t - 0.43)));
    expect(nearest).toBeLessThan(0.002);
    expect(worstStray(corner, samples)).toBeLessThan(0.002);
  });

  test("follows a bend that a coarse grid draws as a facet", () => {
    const bend = (t: number) => 1 / (1 + Math.exp(-40 * (t - 0.5)));
    const coarse = adaptiveSamples(bend, grid(24), 100);
    const fine = adaptiveSamples(bend, grid(24), 0.0005);
    expect(worstStray(bend, coarse)).toBeGreaterThan(0.02);
    expect(worstStray(bend, fine)).toBeLessThan(0.008);
  });

  test("is in order, and stops at a ceiling for a function that jumps", () => {
    const step = (t: number) => (t < 0.5 ? 0 : 1);
    const samples = adaptiveSamples(step, grid(4), 0.0005);
    expect(samples.length).toBeLessThan(5000);
    const ts = samples.map(([t]) => t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
  });
});
