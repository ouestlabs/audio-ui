"use client";

import { createSource, type Source } from "@audio-ui/react";
import { useEffect, useState } from "react";
import {
  DEFAULT_REFERENCE_HZ,
  detectPitch,
  type Note,
  nearestNote,
  type PitchDetectionOptions,
} from "@/registry-audio/bases/base/lib/pitch-detection";

/** What a tuner shows: the note nearest the sound, and how far from it the sound is. */
export interface PitchReading extends Note {
  /** How periodic the sound is, from 0 to 1. */
  confidence: number;
  frequency: number;
}

export interface UsePitchOptions extends PitchDetectionOptions {
  /** How long the last note stays after the sound stops, in milliseconds, so a string's decay does not flicker. @default 600 */
  holdMs?: number;
  /** How many recent detections the reading is the median of: it drops the octave jumps a plucked string starts with. @default 5 */
  median?: number;
  /** The frequency of A4 in hertz. @default 440 */
  reference?: number;
}

/** Detections per second: enough for a needle, at a third of 60 frames' cost. */
const DETECTIONS_PER_SECOND = 20;

const middle = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

/**
 * The pitch of a signal, live: `null` while nothing clear is playing. Pass the
 * `AnalyserNode` of `useMicrophone` (or any tap on your graph). It is a stable
 * source, so a reading costs no React render; `Tuner` paints from it.
 */
export function usePitch(
  analyser: AnalyserNode | null,
  {
    holdMs = 600,
    maxHz,
    median = 5,
    minHz,
    minLevel,
    reference = DEFAULT_REFERENCE_HZ,
    threshold,
  }: UsePitchOptions = {}
): Source<PitchReading | null> {
  const [source] = useState(() => createSource<PitchReading | null>(null));

  useEffect(() => {
    if (!analyser) {
      source.set(null);
      return;
    }
    const samples = new Float32Array(analyser.fftSize);
    const recent: number[] = [];
    const interval = 1000 / DETECTIONS_PER_SECOND;
    let lastRun = 0;
    let lastHeard = 0;
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - lastRun < interval) {
        return;
      }
      lastRun = now;
      analyser.getFloatTimeDomainData(samples);
      const found = detectPitch(samples, analyser.context.sampleRate, {
        maxHz,
        minHz,
        minLevel,
        threshold,
      });
      if (found) {
        lastHeard = now;
        recent.push(found.frequency);
        if (recent.length > median) {
          recent.shift();
        }
        const frequency = middle(recent);
        source.set({
          ...nearestNote(frequency, reference),
          confidence: found.confidence,
          frequency,
        });
      } else if (now - lastHeard > holdMs) {
        recent.length = 0;
        if (source.getSnapshot() !== null) {
          source.set(null);
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      source.set(null);
    };
  }, [
    analyser,
    holdMs,
    maxHz,
    median,
    minHz,
    minLevel,
    reference,
    source,
    threshold,
  ]);

  return source;
}
