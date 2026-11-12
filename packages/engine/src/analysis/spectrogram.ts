import { stftAnalyse } from "@audio/stft";

/** A sound's frequencies over time, as a grid of levels. */
export interface Spectrogram {
  /** How many bins a frame holds, from 0 Hz up to the Nyquist limit. */
  bins: number;
  /** How many frames the grid holds. */
  frames: number;
  /** The width of a bin, in hertz: `bin * hertzPerBin` is its frequency. */
  hertzPerBin: number;
  /** The seconds between two frames. */
  hop: number;
  /** The level of each bin of each frame, a frame after the other, from -`range` dB (0) to 0 dB (255). */
  levels: Uint8Array;
  /** The span of the levels, in dB under full scale. */
  range: number;
}

/** What `spectrogram` takes, all optional. */
export interface SpectrogramOptions {
  /** The samples of a frame, a power of two: more tell the frequencies apart, fewer the moments. @default 1024 */
  frameSize?: number;
  /** The samples between two frames. @default a quarter of the frame */
  hopSize?: number;
  /** How far under full scale the grid reaches, in dB. @default 90 */
  range?: number;
}

/**
 * Reads a sound's frequencies over time: its channels mixed to one, cut into
 * overlapping frames of a Hann window, each frame's magnitudes in dB under the
 * level a full-scale sine reads at, kept as one byte a bin. It reads every
 * sample, a second or two a minute on a laptop.
 */
export function spectrogram(
  channels: readonly Float32Array[],
  sampleRate: number,
  {
    frameSize = 1024,
    hopSize = frameSize / 4,
    range = 90,
  }: SpectrogramOptions = {}
): Spectrogram {
  const length = channels[0]?.length ?? 0;
  const mix = new Float32Array(length);
  for (const channel of channels) {
    for (let index = 0; index < length; index += 1) {
      mix[index] =
        (mix[index] as number) + (channel[index] as number) / channels.length;
    }
  }
  const bins = frameSize / 2 + 1;
  // A full-scale sine under a Hann window reads at a quarter of the frame in a bin.
  const full = frameSize / 4;
  const rows: Uint8Array[] = [];
  stftAnalyse(
    mix,
    (mag) => {
      const row = new Uint8Array(bins);
      for (let bin = 0; bin < bins; bin += 1) {
        const db = 20 * Math.log10(Math.max(mag[bin] as number, 1e-12) / full);
        row[bin] = Math.round(Math.min(1, Math.max(0, 1 + db / range)) * 255);
      }
      rows.push(row);
    },
    { fs: sampleRate, frameSize, hopSize }
  );
  const levels = new Uint8Array(rows.length * bins);
  for (const [index, row] of rows.entries()) {
    levels.set(row, index * bins);
  }
  return {
    bins,
    frames: rows.length,
    hertzPerBin: sampleRate / frameSize,
    hop: hopSize / sampleRate,
    levels,
    range,
  };
}
