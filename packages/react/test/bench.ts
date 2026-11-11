import { expect } from "bun:test";

/** One frame at 120 Hz. */
export const FRAME_MS = 1000 / 120;
/**
 * What a gesture's script may cost: half a frame, because the browser still
 * has to restyle, lay out and paint inside the same 8.3 ms, and those do not
 * run in happy-dom.
 */
export const SCRIPT_BUDGET_MS = FRAME_MS / 2;

const WARMUP_RUNS = 40;
const DEFAULT_RUNS = 400;

/**
 * Fails a bench whose gesture did nothing: a drag that never reaches its
 * handler takes no time and would pass any budget. `changes` is how many
 * times the primitive reported a change during the run.
 */
export function expectWork(changes: number, runs = DEFAULT_RUNS) {
  expect(changes).toBeGreaterThan(runs / 2);
}

export interface Stats {
  max: number;
  p50: number;
  p95: number;
  p99: number;
  runs: number;
}

const percentile = (sorted: number[], share: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;

/**
 * Times `step` once per call, after a warm-up, and fails when its 95th
 * percentile goes over `budget`. `step` receives the run's index, so a drag
 * can move a little further each time. Anything it does inside `act`, such as
 * `fireEvent`, is flushed before the clock stops, so React's render is part
 * of the time.
 */
export function bench(
  label: string,
  step: (index: number) => void,
  { budget = SCRIPT_BUDGET_MS, runs = DEFAULT_RUNS } = {}
): Stats {
  for (let index = 0; index < WARMUP_RUNS; index += 1) {
    step(index);
  }
  const samples: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    step(WARMUP_RUNS + index);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const stats: Stats = {
    max: samples.at(-1) ?? 0,
    p50: percentile(samples, 0.5),
    p95: percentile(samples, 0.95),
    p99: percentile(samples, 0.99),
    runs,
  };
  const fmt = (value: number) => value.toFixed(3).padStart(7);
  console.log(
    `  ${label.padEnd(44)} p50 ${fmt(stats.p50)}  p95 ${fmt(stats.p95)}  p99 ${fmt(stats.p99)}  max ${fmt(stats.max)} ms  (budget ${budget.toFixed(2)})`
  );
  expect(stats.p95).toBeLessThan(budget);
  // The slowest one in a hundred still has to fit a whole frame, not half of it.
  expect(stats.p99).toBeLessThan(FRAME_MS);
  return stats;
}

/**
 * Counts how many times a component renders: put `<Counter />` inside what a
 * live source feeds, and a gesture that goes through React shows up as renders.
 */
export const renderCount = { current: 0 };

/** A point travelling back and forth over a span, so a long run stays in range. */
export const sweep = (index: number, span: number, period = 60) => {
  const phase = (index % period) / period;
  return span * (phase < 0.5 ? phase * 2 : 2 - phase * 2);
};
