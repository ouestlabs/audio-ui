"use client";

import { useEffect, useMemo, useRef } from "react";

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
 * falls, like a real signal's. A stand-in for the levels of an `AnalyserNode`
 * (see `useAudioLevels`), so a demo meter is never at rest. A stable source,
 * so each frame costs no React render. `min` and `max` keep the levels
 * between two values, in dB, for a meter with a narrower scale.
 */
export function useSimulatedLevels(
  channels = 2,
  { max = MAX_DB, min = MIN_DB }: { max?: number; min?: number } = {}
) {
  const start = Math.min(max, Math.max(min, START_DB));
  const frameRef = useRef<SimulatedFrame>({
    levels: Array.from({ length: channels }, () => start),
    peaks: Array.from({ length: channels }, () => start),
  });
  const listenersRef = useRef(new Set<() => void>());

  useEffect(() => {
    const holdUntil = new Array<number>(channels).fill(0);
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - last;
      last = now;
      const previous = frameRef.current;
      const levels = Array.from({ length: channels }, (_, index) =>
        wander(previous.levels[index] ?? start, elapsed, min, max)
      );
      const peaks = levels.map((level, index) => {
        const held = previous.peaks[index] ?? min;
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
      frameRef.current = { levels, peaks };
      for (const listener of listenersRef.current) {
        listener();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [channels, max, min, start]);

  return useMemo(
    () => ({
      getSnapshot: () => frameRef.current,
      subscribe: (listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    }),
    []
  );
}
