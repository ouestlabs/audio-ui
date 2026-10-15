/**
 * Pitch detection for a tuner, on the samples of an `AnalyserNode`
 * (`getFloatTimeDomainData`): the YIN algorithm (de Cheveigné and Kawahara,
 * 2002), then the nearest note and how far from it the pitch is, in cents.
 * Pure functions, no Web Audio: test them on any array of samples.
 */

/** The A above middle C, in hertz, that every other note is tuned from. */
export const DEFAULT_REFERENCE_HZ = 440;

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export interface PitchDetectionOptions {
  /** The highest pitch looked for, in hertz: the search stops at its period, so the result may land a hair beyond it. @default 2000 */
  maxHz?: number;
  /** The lowest pitch looked for, in hertz: lower costs more, and needs at least two of its periods in the samples. @default 40 */
  minHz?: number;
  /** How quiet the signal may be, as an RMS level from 0 to 1, before nothing is detected. @default 0.01 */
  minLevel?: number;
  /** YIN's threshold: how aperiodic a period may be and still count. Lower is stricter. @default 0.15 */
  threshold?: number;
}

export interface PitchEstimate {
  /** How periodic the signal is at that pitch, from 0 to 1: a clean tone is near 1. */
  confidence: number;
  frequency: number;
}

const rms = (samples: Float32Array) => {
  let energy = 0;
  for (const sample of samples) {
    energy += sample * sample;
  }
  return Math.sqrt(energy / samples.length);
};

/**
 * YIN's steps 2 to 4 in one pass: the difference function of `samples` for
 * each lag, normalized by its running mean, until the first dip under
 * `threshold` has reached its bottom. It stops there, so a clear tone costs
 * a few periods of work and only noise runs to `maxLag`. Returns the values
 * so far and the lag of the dip, or -1.
 */
function findDip(
  samples: Float32Array,
  minLag: number,
  maxLag: number,
  threshold: number
) {
  // The window compared with itself shifted by each lag: one period of the
  // lowest pitch, which is enough to tell a period from a multiple of it.
  const window = Math.min(samples.length - maxLag, maxLag);
  const normalized = new Float32Array(maxLag + 1);
  normalized[0] = 1;
  let runningSum = 0;
  let dip = -1;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    const shifted = samples.subarray(lag, lag + window);
    let difference = 0;
    for (let index = 0; index < window; index += 1) {
      const delta = samples[index] - shifted[index];
      difference += delta * delta;
    }
    runningSum += difference;
    const value = runningSum === 0 ? 1 : (difference * lag) / runningSum;
    normalized[lag] = value;
    if (dip < 0) {
      if (lag >= minLag && value < threshold) {
        dip = lag;
      }
    } else if (value < (normalized[dip] ?? 1)) {
      dip = lag;
    } else {
      break;
    }
  }
  return { dip, normalized };
}

/**
 * The fundamental frequency of `samples`, or `null` when the signal is too
 * quiet or has no clear pitch (noise, a chord, silence).
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  {
    maxHz = 2000,
    minHz = 40,
    minLevel = 0.01,
    threshold = 0.15,
  }: PitchDetectionOptions = {}
): PitchEstimate | null {
  if (rms(samples) < minLevel) {
    return null;
  }
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(
    Math.ceil(sampleRate / minHz),
    Math.floor(samples.length / 2)
  );
  if (maxLag <= minLag) {
    return null;
  }
  const { dip: lag, normalized } = findDip(samples, minLag, maxLag, threshold);
  if (lag < 0) {
    return null;
  }

  // Between samples, the bottom of a parabola through the dip (step 5).
  const before = normalized[lag - 1] ?? 1;
  const at = normalized[lag] ?? 1;
  const after = normalized[lag + 1] ?? at;
  const curve = before - 2 * at + after;
  const shift = curve > 0 ? (before - after) / (2 * curve) : 0;

  return {
    confidence: Math.max(0, Math.min(1, 1 - at)),
    frequency: sampleRate / (lag + shift),
  };
}

export interface Note {
  /** How far the frequency is from the note, from -50 (flat) to +50 (sharp) cents. */
  cents: number;
  /** The note's name, sharps for the black keys: `"A"`, `"C#"`. */
  name: string;
  /** The octave in scientific pitch notation: middle C is C4. */
  octave: number;
  /** The note as a MIDI note number: A4 is 69. */
  pitch: number;
}

/** The note nearest `frequency`, with A4 at `reference` hertz. */
export function nearestNote(
  frequency: number,
  reference = DEFAULT_REFERENCE_HZ
): Note {
  const exact = 69 + 12 * Math.log2(frequency / reference);
  const pitch = Math.round(exact);
  return {
    cents: (exact - pitch) * 100,
    name: NOTE_NAMES[((pitch % 12) + 12) % 12] ?? "",
    octave: Math.floor(pitch / 12) - 1,
    pitch,
  };
}

/** The frequency of a MIDI note, `cents` away from it, with A4 at `reference` hertz. */
export function noteFrequency(
  pitch: number,
  cents = 0,
  reference = DEFAULT_REFERENCE_HZ
): number {
  return reference * 2 ** ((pitch - 69 + cents / 100) / 12);
}
