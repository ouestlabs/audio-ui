/**
 * Levels, the way audio engines state them: a gain is a ratio of amplitudes,
 * so 20 dB per factor of ten, 6.02 dB per doubling, and 0 dB is full scale
 * (dBFS) or unity.
 */

/** The amplitude ratio of a level in dB: 0 dB is 1, -6.02 dB is 0.5. `0` for `-Infinity`. */
export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/** The level in dB of an amplitude ratio: 1 is 0 dB, 0.5 is -6.02 dB. `-Infinity` for 0 or less, never `NaN`. */
export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : Number.NEGATIVE_INFINITY;
}

/**
 * The RMS level of `samples` in dBFS: 0 dB for a square wave at full scale, -3
 * dB for a sine at full scale. `-Infinity` for silence, an empty array, or
 * one with a sample that is not a number.
 */
export function rmsDb(samples: Float32Array | readonly number[]): number {
  if (samples.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Number.isFinite(sum)
    ? gainToDb(Math.sqrt(sum / samples.length))
    : Number.NEGATIVE_INFINITY;
}
