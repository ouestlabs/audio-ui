const MIN_DB = -60;
const MAX_DB = 3;
const WANDER_DB_PER_SECOND = 60;
const PEAK_HOLD_MS = 1200;
const PEAK_DECAY_DB_PER_SECOND = 18;
const START_DB = -27;

export interface SimulatedFrame {
  levels: readonly number[];
  peaks: readonly number[];
}

function wander(current: number, elapsedMs: number, min: number, max: number) {
  const next =
    current + (Math.random() - 0.5) * WANDER_DB_PER_SECOND * (elapsedMs / 1000);
  return Math.min(max, Math.max(min, next));
}

/**
 * Levels that move on their own, in the shape a `Meter` paints from: a
 * random walk per channel with a peak that holds for a moment and then
 * falls, like a real signal's. A stand-in for the levels of an `AnalyserNode`,
 * so a demo meter is never at rest. `min` and `max` keep the levels between
 * two values, in dB, for a meter with a narrower scale. `source` is a live
 * source, and `start()` runs it until the function it returns is called.
 */
export function createSimulatedLevels(
  channels = 2,
  { max = MAX_DB, min = MIN_DB }: { max?: number; min?: number } = {}
) {
  const start = Math.min(max, Math.max(min, START_DB));
  let frame: SimulatedFrame = {
    levels: Array.from({ length: channels }, () => start),
    peaks: Array.from({ length: channels }, () => start),
  };
  const listeners = new Set<() => void>();
  const source = {
    getSnapshot: () => frame,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  const run = () => {
    const holdUntil = new Array<number>(channels).fill(0);
    let last = performance.now();
    let id = 0;
    const tick = (now: number) => {
      const elapsed = now - last;
      last = now;
      const levels = Array.from({ length: channels }, (_, index) =>
        wander(frame.levels[index] ?? start, elapsed, min, max)
      );
      const peaks = levels.map((level, index) => {
        const held = frame.peaks[index] ?? min;
        if (level >= held) {
          holdUntil[index] = now + PEAK_HOLD_MS;
          return level;
        }
        if (now < (holdUntil[index] ?? 0)) {
          return held;
        }
        return Math.max(
          level,
          held - (PEAK_DECAY_DB_PER_SECOND * elapsed) / 1000
        );
      });
      frame = { levels, peaks };
      for (const listener of listeners) {
        listener();
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  };

  return { run, source };
}
