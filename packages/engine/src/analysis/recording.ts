import detectBeat from "@audio/beat-detect";
import chroma from "@audio/mir-chroma";
import { detectTransients, type TempoEstimate } from "./beat.ts";

/** What a recording's beat is read as when it comes in: its tempo, if it has one, and its transients, in seconds. */
export interface BeatAnalysis {
  estimate: TempoEstimate | null;
  transients: number[];
}

/** How near a grid's beat a transient falls to count for it, in beats: first loosely, then closely. */
const GRID_REACHES = [1 / 8, 1 / 16];
/** How many transients a grid needs to be fitted on. */
const FIT_POINTS = 8;

/** How many of `transients` fall within an eighth of a beat of a grid of `period` seconds from `start`. */
function alignedCount(
  transients: readonly number[],
  start: number,
  period: number
): number {
  let count = 0;
  for (const time of transients) {
    const beat = Math.round((time - start) / period);
    if (Math.abs(time - (start + beat * period)) < period / 8) {
      count += 1;
    }
  }
  return count;
}

/**
 * The grid of `bpm` from `firstBeat`, fitted on the transients near its
 * beats: its phase is the one that lines up the most of them, and its beat
 * the slope of a least-squares line through them, read twice, the second
 * time nearer. A tempo read in whole BPM, as 128 for 127.3, would drift a
 * third of a second a minute; fitted, it holds to the sample.
 */
function fittedGrid(
  bpm: number,
  firstBeat: number,
  transients: readonly number[]
): { bpm: number; firstBeat: number } {
  let period = 60 / bpm;
  let start = firstBeat;
  let most = alignedCount(transients, start, period);
  for (const time of transients) {
    if (time > firstBeat + 8 * period) {
      break;
    }
    const count = alignedCount(transients, time, period);
    if (count > most) {
      most = count;
      start = time;
    }
  }
  for (const reach of GRID_REACHES) {
    const beats: number[] = [];
    const times: number[] = [];
    for (const time of transients) {
      const beat = Math.round((time - start) / period);
      if (Math.abs(time - (start + beat * period)) < reach * period) {
        beats.push(beat);
        times.push(time);
      }
    }
    if (beats.length < FIT_POINTS) {
      break;
    }
    const meanBeat = beats.reduce((sum, beat) => sum + beat, 0) / beats.length;
    const meanTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    let covariance = 0;
    let spread = 0;
    for (const [index, beat] of beats.entries()) {
      covariance += (beat - meanBeat) * ((times[index] as number) - meanTime);
      spread += (beat - meanBeat) ** 2;
    }
    const slope = covariance / spread;
    // A slope far from the beat read is a fit gone astray: the grid stays as it is.
    if (!(slope > 0 && Math.abs(slope / period - 1) < 0.02)) {
      break;
    }
    period = slope;
    start = meanTime - slope * meanBeat;
  }
  start -= Math.floor(start / period) * period;
  return { bpm: 60 / period, firstBeat: start };
}

/** The window a recording's chroma is read on, in samples: a power of two, as the FFT takes, near 0.17 s at 48 kHz. */
const CHROMA_WINDOW = 8192;
/** A window quieter than this, as a mean square, is silence: it says nothing of the key. */
const CHROMA_SILENCE = 1e-6;

/**
 * How much of a recording's sound lies in each pitch class, C to B, summing
 * to 1, read once as it is decoded: what a key is read from, with notes or
 * without (`detectKeys` of the Scale menu). Its channels mixed, it is the
 * chroma of `@audio/mir-chroma` on each window that is not silence, averaged.
 * All zeros for a recording that is all silence.
 */
export function audioChroma(
  channels: readonly Float32Array[],
  sampleRate: number
): number[] {
  const length = channels[0]?.length ?? 0;
  const sum = new Array<number>(12).fill(0);
  const mix = new Float32Array(CHROMA_WINDOW);
  let frames = 0;
  for (let at = 0; at + CHROMA_WINDOW <= length; at += CHROMA_WINDOW) {
    let energy = 0;
    for (let frame = 0; frame < CHROMA_WINDOW; frame += 1) {
      let sample = 0;
      for (const channel of channels) {
        sample += channel[at + frame] as number;
      }
      sample /= channels.length;
      mix[frame] = sample;
      energy += sample * sample;
    }
    if (energy / CHROMA_WINDOW >= CHROMA_SILENCE) {
      const read = chroma(mix, { fs: sampleRate });
      for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
        sum[pitchClass] = (sum[pitchClass] as number) + (read[pitchClass] ?? 0);
      }
      frames += 1;
    }
  }
  return frames > 0 ? sum.map((value) => value / frames) : sum;
}

/**
 * Reads a recording's beat, once, as it is decoded: what `warpOnImport` warps
 * its clips by. `@audio/beat-detect` reads its tempo, which finds the beat of
 * real playing; the grid is then fitted on the transients, to the sample.
 * A sound with no attack (silence, noise, a single hit read with no
 * confidence) has no tempo.
 */
export function analyzeBeat(
  channels: readonly Float32Array[],
  sampleRate: number
): BeatAnalysis {
  const [first] = channels;
  let mix = first ?? new Float32Array(0);
  if (channels.length > 1) {
    mix = new Float32Array(mix.length);
    for (const channel of channels) {
      for (const [index, sample] of channel.entries()) {
        mix[index] = (mix[index] as number) + sample / channels.length;
      }
    }
  }
  const read = detectBeat(mix, { fs: sampleRate });
  const [firstBeat] = read.beats;
  if (
    !(
      read.bpm > 0 &&
      read.confidence > 0 &&
      read.onsets.length > 0 &&
      firstBeat !== undefined
    )
  ) {
    return { estimate: null, transients: [] };
  }
  const transients = detectTransients(channels, sampleRate);
  return {
    estimate: {
      confidence: read.confidence,
      ...fittedGrid(read.bpm, firstBeat, transients),
    },
    transients,
  };
}
