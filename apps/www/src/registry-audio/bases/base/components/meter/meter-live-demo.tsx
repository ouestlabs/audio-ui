"use client";

import { useEffect, useMemo, useRef } from "react";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";

const MIN_DB = -60;
const MAX_DB = 3;
const WANDER_DB_PER_SECOND = 60;
const PEAK_HOLD_MS = 1200;
const PEAK_DECAY_DB_PER_SECOND = 18;
const INITIAL_LEVELS = [-24, -30];

interface LevelsFrame {
  levels: readonly number[];
  peaks: readonly number[];
}

function nextLevel(current: number, elapsedMs: number) {
  const next =
    current + (Math.random() - 0.5) * WANDER_DB_PER_SECOND * (elapsedMs / 1000);
  return Math.min(MAX_DB, Math.max(MIN_DB, next));
}

/** Random-walk stand-in for real levels, in the same shape `useAudioLevels` returns for an AnalyserNode: a stable source the Meter paints from, so each frame costs no React render. */
function useRandomLevels() {
  const frameRef = useRef<LevelsFrame>({
    levels: INITIAL_LEVELS,
    peaks: INITIAL_LEVELS,
  });
  const listenersRef = useRef(new Set<() => void>());

  useEffect(() => {
    const peakHoldUntil = [0, 0];
    let lastFrameTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsedMs = now - lastFrameTime;
      lastFrameTime = now;
      const previous = frameRef.current;

      const levels = previous.levels.map((level) =>
        nextLevel(level, elapsedMs)
      );
      const peaks = levels.map((level, index) => {
        const previousPeak = previous.peaks[index] ?? MIN_DB;
        if (level >= previousPeak) {
          peakHoldUntil[index] = now + PEAK_HOLD_MS;
          return level;
        }
        if (now < (peakHoldUntil[index] ?? 0)) {
          return previousPeak;
        }
        const decayed =
          previousPeak - (PEAK_DECAY_DB_PER_SECOND * elapsedMs) / 1000;
        return Math.max(level, decayed);
      });

      frameRef.current = { levels, peaks };
      for (const listener of listenersRef.current) {
        listener();
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

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

export default function MeterLiveDemo() {
  const source = useRandomLevels();
  return <Meter aria-label="Stereo output" source={source} />;
}
