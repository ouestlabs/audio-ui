import yin from "@audio/pitch-yin";

/** A signal's loudness as an RMS level, from 0 to 1. */
const rms = (samples: Float32Array) => {
  let energy = 0;
  for (const sample of samples) {
    energy += sample * sample;
  }
  return Math.sqrt(energy / samples.length);
};

/** What a detection found: the pitch and how periodic the sound is there. */
export interface PitchEstimate {
  confidence: number;
  frequency: number;
}

/** What `detectPitch` looks for. */
export interface DetectPitchOptions {
  /** The highest pitch looked for, in hertz. */
  maxHz: number;
  /** The lowest pitch looked for, in hertz: lower costs more, and needs at least two of its periods in the samples. */
  minHz: number;
  /** How quiet the signal may be, as an RMS level from 0 to 1, before nothing is detected. */
  minLevel: number;
  /** YIN's threshold: how aperiodic a period may be and still count. Lower is stricter. */
  threshold: number;
}

/** The pitch the samples hold and how clear it is, or nothing: too quiet a signal, or no clear period. */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  { maxHz, minHz, minLevel, threshold }: DetectPitchOptions
): PitchEstimate | null {
  if (rms(samples) < minLevel) {
    return null;
  }
  const heard = yin(samples, {
    fs: sampleRate,
    maxFreq: maxHz,
    minFreq: minHz,
    threshold,
  });
  return heard ? { confidence: heard.clarity, frequency: heard.freq } : null;
}
