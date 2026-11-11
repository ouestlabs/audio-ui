"use client";

import { detectPitch, type PitchEstimate } from "@audio-ui/engine/analysis";
import { cents } from "@audio-ui/engine/pitch";
import { createSource, type Source } from "@audio-ui/react";
import { useEffect, useState } from "react";

/** What a tuner shows: the note nearest the sound, and how far from it the sound is. */
export interface PitchReading {
  /** How far the frequency is from the note, from -50 (flat) to +50 (sharp) cents. */
  cents: number;
  /** How periodic the sound is, from 0 to 1. */
  confidence: number;
  frequency: number;
  /** The note's name, sharps for the black keys: `"A"`, `"C#"`. */
  name: string;
  /** The octave in scientific pitch notation: middle C is C4. */
  octave: number;
  /** The note as a MIDI note number: A4 is 69. */
  pitch: number;
}

export interface UsePitchOptions {
  /** How long the last note stays after the sound stops, in milliseconds, so a string's decay does not flicker. @default 600 */
  holdMs?: number;
  /** The highest pitch looked for, in hertz. @default 2000 */
  maxHz?: number;
  /** How many recent detections the reading is the median of: it drops the octave jumps a plucked string starts with. @default 5 */
  median?: number;
  /** The lowest pitch looked for, in hertz: lower costs more, and needs at least two of its periods in the samples. @default 40 */
  minHz?: number;
  /** How quiet the signal may be, as an RMS level from 0 to 1, before nothing is detected. @default 0.01 */
  minLevel?: number;
  /** The frequency of A4 in hertz. @default 440 */
  reference?: number;
  /** YIN's threshold: how aperiodic a period may be and still count. Lower is stricter. @default 0.1 */
  threshold?: number;
}

/** A note's name as `@audio/note` writes it, split into its letter and its octave: `"A#4"`. */
const NOTE_NAME = /^(.*?)(-?\d+)$/;

/** Detections per second: enough for a needle, at a third of 60 frames' cost. */
const DETECTIONS_PER_SECOND = 20;

const middle = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

/** Adds a detection to the recent ones and returns the reading they steady to: the median frequency and its note. */
function steadied(
  recent: number[],
  { confidence, frequency }: PitchEstimate,
  size: number,
  reference: number
): PitchReading | null {
  recent.push(frequency);
  if (recent.length > size) {
    recent.shift();
  }
  const steady = middle(recent);
  if (!(steady > 0)) {
    return null;
  }
  const note = cents(steady, { a4: reference });
  const [, name = "", octave = "0"] = NOTE_NAME.exec(note.name) ?? [];
  return {
    cents: note.cents,
    confidence,
    frequency: steady,
    name,
    octave: Number(octave),
    pitch: note.midi,
  };
}

/**
 * The pitch of a signal, live: `null` while nothing clear is playing. Pass the
 * `AnalyserNode` of `useMicrophone` (or any tap on your graph). It is a stable
 * source, so a reading costs no React render; `Tuner` paints from it.
 */
export function usePitch(
  analyser: AnalyserNode | null,
  {
    holdMs = 600,
    maxHz = 2000,
    median = 5,
    minHz = 40,
    minLevel = 0.01,
    reference = 440,
    threshold = 0.1,
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
        const reading = steadied(recent, found, median, reference);
        if (reading) {
          source.set(reading);
        }
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
