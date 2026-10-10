"use client";

import { useEffect, useMemo, useRef } from "react";

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

function silence(channelCount: number): AudioLevelsFrame {
  const levels = Array.from({ length: channelCount }, () => SILENCE_DB);
  return { levels, peaks: levels };
}

/** One reading: the RMS level and the peak-hold level per channel, in dB. */
export interface AudioLevelsFrame {
  levels: readonly number[];
  peaks: readonly number[];
}

/**
 * A live level signal, in the shape of an external store. Pass it to Meter's
 * `source`, or read it in React with `useSyncExternalStore(subscribe, getSnapshot)`.
 */
export interface AudioLevelsSource {
  getSnapshot: () => AudioLevelsFrame;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Samples RMS level (in dB) from one AnalyserNode per channel every animation
 * frame (synced to the display refresh rate, typically 60fps — and paused
 * automatically when the tab is backgrounded), with a peak-hold level that
 * holds the loudest recent level for 1.5s before decaying.
 *
 * Returns a stable source rather than React state, so sampling never
 * re-renders the component that calls it: pass it to Meter's `source`.
 * Memoize the `analysers` array — a new array identity restarts sampling.
 */
export function useAudioLevels(
  analysers: Array<AnalyserNode | null>
): AudioLevelsSource {
  const frameRef = useRef<AudioLevelsFrame>(silence(analysers.length));
  const listenersRef = useRef(new Set<() => void>());

  const source = useMemo<AudioLevelsSource>(
    () => ({
      getSnapshot: () => frameRef.current,
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    }),
    []
  );

  useEffect(() => {
    const publish = (frame: AudioLevelsFrame) => {
      frameRef.current = frame;
      for (const listener of listenersRef.current) {
        listener();
      }
    };

    const channelCount = analysers.length;
    publish(silence(channelCount));
    if (channelCount === 0) {
      return;
    }

    const buffers = analysers.map(
      (analyser) => new Float32Array(analyser?.fftSize ?? 2048)
    );
    const peakHoldUntil = Array.from({ length: channelCount }, () => 0);
    let lastPeaks = silence(channelCount).peaks;
    let lastFrameTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsedMs = now - lastFrameTime;
      lastFrameTime = now;

      const levels: number[] = [];
      const peaks: number[] = [];

      for (const [i, analyser] of analysers.entries()) {
        const buffer = buffers[i];
        const db =
          analyser && buffer ? computeRmsDb(analyser, buffer) : SILENCE_DB;
        levels.push(db);

        const previousPeak = lastPeaks[i] ?? SILENCE_DB;
        if (db >= previousPeak) {
          peakHoldUntil[i] = now + PEAK_HOLD_MS;
          peaks.push(db);
        } else if (now < (peakHoldUntil[i] ?? 0)) {
          peaks.push(previousPeak);
        } else {
          const decayed =
            previousPeak - (PEAK_DECAY_DB_PER_SECOND * elapsedMs) / 1000;
          peaks.push(Math.max(db, decayed));
        }
      }

      lastPeaks = peaks;
      publish({ levels, peaks });
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [analysers]);

  return source;
}
