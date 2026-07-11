"use client";

import { useEffect, useRef, useState } from "react";

const PEAK_HOLD_MS = 1500;
const PEAK_DECAY_DB_PER_SECOND = 12;
const SILENCE_DB = -100;

function computeRmsDb(
  analyser: AnalyserNode,
  buffer: Float32Array<ArrayBuffer>
): number {
  analyser.getFloatTimeDomainData(buffer);
  let sumOfSquares = 0;
  for (const sample of buffer) {
    sumOfSquares += sample * sample;
  }
  const rms = Math.sqrt(sumOfSquares / buffer.length);
  return rms > 0 ? 20 * Math.log10(rms) : SILENCE_DB;
}

export interface UseAudioLevelsReturn {
  levels: number[];
  peaks: number[];
}

/**
 * Samples RMS level (in dB) from one AnalyserNode per channel every animation
 * frame (synced to the display refresh rate, typically 60fps — and paused
 * automatically when the tab is backgrounded), with a peak-hold mark that
 * holds the loudest recent level for 1.5s before decaying. Feed `levels` to
 * Meter's `value` and `peaks` to `Meter.Peak`. Memoize the `analysers` array
 * — a new array identity restarts sampling.
 */
export function useAudioLevels(
  analysers: Array<AnalyserNode | null>
): UseAudioLevelsReturn {
  const channelCount = analysers.length;
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: channelCount }, () => SILENCE_DB)
  );
  const [peaks, setPeaks] = useState<number[]>(() =>
    Array.from({ length: channelCount }, () => SILENCE_DB)
  );

  const peakHoldUntilRef = useRef<number[]>([]);

  useEffect(() => {
    if (channelCount === 0) {
      return;
    }

    const buffers = analysers.map(
      (analyser) => new Float32Array(analyser?.fftSize ?? 2048)
    );
    peakHoldUntilRef.current = Array.from({ length: channelCount }, () => 0);
    let lastPeaks = Array.from({ length: channelCount }, () => SILENCE_DB);
    let lastFrameTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsedMs = now - lastFrameTime;
      lastFrameTime = now;

      const nextLevels: number[] = [];
      const nextPeaks: number[] = [];

      for (const [i, analyser] of analysers.entries()) {
        const buffer = buffers[i];
        const db =
          analyser && buffer ? computeRmsDb(analyser, buffer) : SILENCE_DB;
        nextLevels.push(db);

        const previousPeak = lastPeaks[i] ?? SILENCE_DB;
        if (db >= previousPeak) {
          peakHoldUntilRef.current[i] = now + PEAK_HOLD_MS;
          nextPeaks.push(db);
        } else if (now < (peakHoldUntilRef.current[i] ?? 0)) {
          nextPeaks.push(previousPeak);
        } else {
          const decayed =
            previousPeak - (PEAK_DECAY_DB_PER_SECOND * elapsedMs) / 1000;
          nextPeaks.push(Math.max(db, decayed));
        }
      }

      lastPeaks = nextPeaks;
      setLevels(nextLevels);
      setPeaks(nextPeaks);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [analysers, channelCount]);

  return { levels, peaks };
}
