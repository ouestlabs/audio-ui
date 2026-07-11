"use client";

import { useEffect, useState } from "react";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";

const MIN_DB = -60;
const MAX_DB = 3;
const WANDER_DB_PER_SECOND = 60;
const PEAK_HOLD_MS = 1200;
const PEAK_DECAY_DB_PER_SECOND = 18;
const INITIAL_LEVELS = [-24, -30];

/** Random-walk stand-in for real levels — swap for `useAudioLevels` fed by an AnalyserNode. */
function nextLevel(current: number, elapsedMs: number) {
  const next =
    current + (Math.random() - 0.5) * WANDER_DB_PER_SECOND * (elapsedMs / 1000);
  return Math.min(MAX_DB, Math.max(MIN_DB, next));
}

export default function MeterLiveDemo() {
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [peaks, setPeaks] = useState(INITIAL_LEVELS);

  useEffect(() => {
    let currentLevels = INITIAL_LEVELS;
    let currentPeaks = INITIAL_LEVELS;
    const peakHoldUntil = [0, 0];
    let lastFrameTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsedMs = now - lastFrameTime;
      lastFrameTime = now;

      currentLevels = currentLevels.map((level) => nextLevel(level, elapsedMs));

      currentPeaks = currentLevels.map((level, index) => {
        const previousPeak = currentPeaks[index] ?? MIN_DB;
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

      setLevels(currentLevels);
      setPeaks(currentPeaks);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return <Meter aria-label="Stereo output" peak={peaks} value={levels} />;
}
