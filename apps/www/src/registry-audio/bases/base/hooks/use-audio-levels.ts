"use client";

import { createSource, type Meter } from "@audio-ui/react";
import { useEffect, useState } from "react";

/** Below what a Meter draws: the level of digital silence. */
const SILENCE_DB = -100;
/** How fast the level falls back once the signal drops, as a meter's needle would. */
const RELEASE_DB_PER_SECOND = 30;
const PEAK_HOLD_MS = 1500;
const PEAK_FALL_DB_PER_SECOND = 12;

/** The RMS level of the analyser's latest samples, in dB. */
function rmsDb(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) {
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / buffer.length);
  return rms > 0 ? 20 * Math.log10(rms) : SILENCE_DB;
}

const silence = (channels: number): Meter.Root.Frame => ({
  levels: Array.from({ length: channels }, () => SILENCE_DB),
  peaks: Array.from({ length: channels }, () => SILENCE_DB),
});

/**
 * The live levels of a signal, one channel per analyser, in the shape a
 * `Meter` paints from: RMS in dB that falls back smoothly, with a peak that
 * holds and then falls. Tap the signal with an `AnalyserNode` per channel (a
 * `ChannelSplitter` splits a stereo one) and pass them here, memoized: a new
 * array restarts the sampling.
 * A stable source, so each frame costs no React render; while the signal is
 * silent, nothing is published at all.
 */
export function useAudioLevels(analysers: readonly AnalyserNode[]) {
  const [source] = useState(() =>
    createSource<Meter.Root.Frame>(silence(analysers.length))
  );

  useEffect(() => {
    const channels = analysers.map((analyser) => ({
      analyser,
      buffer: new Float32Array(analyser.fftSize),
      holdUntil: 0,
      level: SILENCE_DB,
      peak: SILENCE_DB,
    }));
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      const levels: number[] = [];
      const peaks: number[] = [];
      for (const channel of channels) {
        // It rises at once and falls at the release rate.
        const db = Math.max(
          rmsDb(channel.analyser, channel.buffer),
          channel.level - RELEASE_DB_PER_SECOND * elapsed,
          SILENCE_DB
        );
        channel.level = db;
        if (db >= channel.peak) {
          channel.peak = db;
          channel.holdUntil = now + PEAK_HOLD_MS;
        } else if (now > channel.holdUntil) {
          channel.peak = Math.max(
            db,
            channel.peak - PEAK_FALL_DB_PER_SECOND * elapsed
          );
        }
        levels.push(db);
        peaks.push(channel.peak);
      }
      const previous = source.getSnapshot();
      const unchanged =
        previous.levels.length === levels.length &&
        levels.every(
          (db, index) =>
            db === SILENCE_DB &&
            previous.levels[index] === SILENCE_DB &&
            previous.peaks?.[index] === peaks[index]
        );
      if (!unchanged) {
        source.set({ levels, peaks });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      source.set(silence(channels.length));
    };
  }, [analysers, source]);

  return source;
}
