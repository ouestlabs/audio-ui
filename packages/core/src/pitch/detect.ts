/**
 * Pitch detection on audio samples (`AnalyserNode.getFloatTimeDomainData`, or
 * any array): the YIN algorithm (de Cheveigné and Kawahara, "YIN, a
 * fundamental frequency estimator for speech and music", JASA 111(4), 2002).
 * A pure function, with no Web Audio in it.
 *
 * It follows the paper's steps 2 to 5: the difference function, its
 * cumulative mean normalization, the absolute threshold and the parabolic
 * interpolation. Step 1 (autocorrelation) is the paper's own starting point
 * and step 2 replaces it. Step 6, the best local estimate, is left out: it
 * steadies a reading over time, which `usePitch` does with a median of the
 * last readings. Where no period crosses the threshold the result is `null`,
 * not the deepest dip: a tuner is better silent than wrong.
 */

export interface PitchDetectionOptions {
  /** The highest pitch looked for, in hertz: the search stops at its period, so the result may land a hair beyond it. @default 2000 */
  maxHz?: number;
  /** The lowest pitch looked for, in hertz: lower costs more, and needs at least two of its periods in the samples. @default 40 */
  minHz?: number;
  /** How quiet the signal may be, as an RMS level from 0 to 1, before nothing is detected. @default 0.01 */
  minLevel?: number;
  /** YIN's threshold: how aperiodic a period may be and still count. Lower is stricter. @default 0.1 */
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
      const delta = (samples[index] ?? 0) - (shifted[index] ?? 0);
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
    threshold = 0.1,
  }: PitchDetectionOptions = {}
): PitchEstimate | null {
  if (!(Number.isFinite(sampleRate) && sampleRate > 0)) {
    return null;
  }
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
