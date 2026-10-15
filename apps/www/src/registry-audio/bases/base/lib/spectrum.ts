/**
 * Turns what an `AnalyserNode` reports into what a plot draws: a spectrum with
 * as many points as you ask for, spread evenly along a logarithmic frequency
 * axis, the way an equalizer's x axis runs. An analyser's bins are spread
 * evenly in hertz, so most of them crowd above 2 kHz and the low end gets a
 * handful; here each point takes the loudest bin it covers, and below the
 * resolution of the analyser a point reads between the two bins around it.
 */

/** The quietest a point is drawn: what a silent bin, `-Infinity` dB, becomes. */
export const SPECTRUM_FLOOR_DB = -140;

export interface LogSpectrumOptions {
  /** Highest frequency on the axis. @default 20000 */
  maxHz?: number;
  /** Lowest frequency on the axis. @default 20 */
  minHz?: number;
}

/**
 * Fills `out` with `bins` (dB per analyser bin, as `getFloatFrequencyData`
 * writes them) resampled onto a log axis. `sampleRate` is the context's.
 * Returns `out`, so a caller can keep and publish one array.
 */
export function logSpectrum(
  bins: ArrayLike<number>,
  sampleRate: number,
  out: Float32Array,
  { maxHz = 20_000, minHz = 20 }: LogSpectrumOptions = {}
): Float32Array {
  const count = out.length;
  const binWidth = sampleRate / (bins.length * 2);
  const ratio = maxHz / minHz;
  /** The frequency a position along the axis, in points, falls at. */
  const hzAt = (point: number) =>
    minHz * ratio ** (point / Math.max(count - 1, 1));
  const dbAt = (bin: number) => {
    const value =
      bins[Math.min(bins.length - 1, Math.max(0, bin))] ?? SPECTRUM_FLOOR_DB;
    return Number.isFinite(value)
      ? Math.max(value, SPECTRUM_FLOOR_DB)
      : SPECTRUM_FLOOR_DB;
  };

  for (let point = 0; point < count; point += 1) {
    const from = hzAt(point - 0.5) / binWidth;
    const to = hzAt(point + 0.5) / binWidth;
    const first = Math.ceil(from);
    const last = Math.floor(to);
    if (last >= first) {
      let loudest = SPECTRUM_FLOOR_DB;
      for (let bin = first; bin <= last; bin += 1) {
        loudest = Math.max(loudest, dbAt(bin));
      }
      out[point] = loudest;
    } else {
      // Narrower than a bin: read between the two around the point's centre.
      const centre = hzAt(point) / binWidth;
      const below = Math.floor(centre);
      const share = centre - below;
      out[point] = dbAt(below) * (1 - share) + dbAt(below + 1) * share;
    }
  }
  return out;
}

export interface PeakHoldOptions {
  /** How fast a peak falls once its hold is over, in dB per second. @default 24 */
  fall?: number;
  /** How long a peak stays put before it falls, in seconds. @default 1 */
  hold?: number;
}

/**
 * Keeps the loudest level each point of a spectrum reached: a peak rises with
 * the spectrum at once, stays put for `hold` seconds, then falls at `fall` dB
 * per second until the spectrum meets it again. `peaks` and `holding` (seconds
 * of hold left per point) are updated in place, `elapsed` seconds after the
 * last call. Returns `peaks`.
 */
export function holdPeaks(
  spectrum: ArrayLike<number>,
  peaks: Float32Array,
  holding: Float32Array,
  elapsed: number,
  { fall = 24, hold = 1 }: PeakHoldOptions = {}
): Float32Array {
  for (let point = 0; point < peaks.length; point += 1) {
    const level = spectrum[point] ?? SPECTRUM_FLOOR_DB;
    const peak = peaks[point] ?? SPECTRUM_FLOOR_DB;
    const left = holding[point] ?? 0;
    if (level >= peak) {
      peaks[point] = level;
      holding[point] = hold;
    } else if (left > 0) {
      holding[point] = left - elapsed;
    } else {
      peaks[point] = Math.max(level, peak - fall * elapsed);
    }
  }
  return peaks;
}
