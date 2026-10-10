/**
 * What a filter, an equalizer and a compressor do to a signal, as the curves a
 * plot draws: a gain in dB at each frequency, an output level at each input
 * level. Framework-free and drawn from the same textbook formulas an audio
 * engine runs (the RBJ "Audio EQ Cookbook" biquads), so the curve on screen
 * is the response you hear. The sample rate only decides where the top of the
 * curve bends toward Nyquist; 48 kHz is close enough for a picture.
 */

export const SAMPLE_RATE = 48_000;
const NYQUIST_SHARE = 0.49;
const MIN_Q = 0.05;
/** The quietest a magnitude is drawn, so a notch's null stays on the plot. */
const MIN_MAGNITUDE = 1e-9;

export type BiquadType =
  | "bandpass"
  | "highcut"
  | "highshelf"
  | "lowcut"
  | "lowshelf"
  | "notch"
  | "peak";

export interface BiquadSettings {
  frequency: number;
  /** Gain in dB: used by peaks and shelves, ignored by the rest. */
  gainDb?: number;
  q?: number;
  type: BiquadType;
}

interface Coefficients {
  a1: number;
  a2: number;
  b0: number;
  b1: number;
  b2: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Coefficients divided by a0, from the cookbook. */
function coefficients({
  frequency,
  gainDb = 0,
  q = Math.SQRT1_2,
  type,
}: BiquadSettings): Coefficients {
  const w0 =
    (2 * Math.PI * clamp(frequency, 10, SAMPLE_RATE * NYQUIST_SHARE)) /
    SAMPLE_RATE;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.max(q, MIN_Q));
  const a = 10 ** (gainDb / 40);
  const shelf = 2 * Math.sqrt(a) * alpha;

  let b: [number, number, number];
  let denominator: [number, number, number];
  switch (type) {
    case "lowshelf":
      b = [
        a * (a + 1 - (a - 1) * cos + shelf),
        2 * a * (a - 1 - (a + 1) * cos),
        a * (a + 1 - (a - 1) * cos - shelf),
      ];
      denominator = [
        a + 1 + (a - 1) * cos + shelf,
        -2 * (a - 1 + (a + 1) * cos),
        a + 1 + (a - 1) * cos - shelf,
      ];
      break;
    case "highshelf":
      b = [
        a * (a + 1 + (a - 1) * cos + shelf),
        -2 * a * (a - 1 + (a + 1) * cos),
        a * (a + 1 + (a - 1) * cos - shelf),
      ];
      denominator = [
        a + 1 - (a - 1) * cos + shelf,
        2 * (a - 1 - (a + 1) * cos),
        a + 1 - (a - 1) * cos - shelf,
      ];
      break;
    case "lowcut":
      b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
      denominator = [1 + alpha, -2 * cos, 1 - alpha];
      break;
    case "highcut":
      b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
      denominator = [1 + alpha, -2 * cos, 1 - alpha];
      break;
    case "bandpass":
      b = [alpha, 0, -alpha];
      denominator = [1 + alpha, -2 * cos, 1 - alpha];
      break;
    case "notch":
      b = [1, -2 * cos, 1];
      denominator = [1 + alpha, -2 * cos, 1 - alpha];
      break;
    default:
      b = [1 + alpha * a, -2 * cos, 1 - alpha * a];
      denominator = [1 + alpha / a, -2 * cos, 1 - alpha / a];
  }
  const [a0, a1, a2] = denominator;
  return {
    a1: a1 / a0,
    a2: a2 / a0,
    b0: b[0] / a0,
    b1: b[1] / a0,
    b2: b[2] / a0,
  };
}

/** A biquad's gain in dB at `hz`, 0 being unity. */
export function biquadResponse(
  settings: BiquadSettings
): (hz: number) => number {
  const { a1, a2, b0, b1, b2 } = coefficients(settings);
  return (hz) => {
    const omega = (2 * Math.PI * hz) / SAMPLE_RATE;
    const numerator = Math.hypot(
      b0 + b1 * Math.cos(omega) + b2 * Math.cos(2 * omega),
      b1 * Math.sin(omega) + b2 * Math.sin(2 * omega)
    );
    const denominator = Math.hypot(
      1 + a1 * Math.cos(omega) + a2 * Math.cos(2 * omega),
      a1 * Math.sin(omega) + a2 * Math.sin(2 * omega)
    );
    if (denominator === 0) {
      return 0;
    }
    return 20 * Math.log10(Math.max(numerator / denominator, MIN_MAGNITUDE));
  };
}

export interface EqBand extends BiquadSettings {
  /** Whether the band is in the chain. @default true */
  on?: boolean;
}

/** An equalizer's bands in series: their gains in dB add up at each frequency. */
export function eqResponse(bands: readonly EqBand[]): (hz: number) => number {
  const responses = bands
    .filter((band) => band.on !== false)
    .map((band) => biquadResponse(band));
  return (hz) => responses.reduce((db, response) => db + response(hz), 0);
}

export interface CompressorSettings {
  /** Width in dB of the soft bend around the threshold. @default 0 */
  kneeDb?: number;
  /** Gain added after compressing, in dB. @default 0 */
  makeupDb?: number;
  /** Input to output ratio above the threshold: 4 is 4:1. */
  ratio: number;
  thresholdDb: number;
}

/**
 * A compressor's transfer curve: the output level in dB for each input level
 * in dB. Below the threshold the level passes unchanged; above it, every
 * `ratio` dB in comes out as one, with a quadratic bend across the knee.
 */
export function compressorOutput({
  kneeDb = 0,
  makeupDb = 0,
  ratio,
  thresholdDb,
}: CompressorSettings): (inputDb: number) => number {
  const slope = 1 / Math.max(ratio, 1) - 1;
  const half = Math.max(kneeDb, 0) / 2;
  return (inputDb) => {
    const over = inputDb - thresholdDb;
    let reduction = 0;
    if (half > 0 && Math.abs(over) <= half) {
      reduction = (slope * (over + half) ** 2) / (4 * half);
    } else if (over > half) {
      reduction = slope * over;
    }
    return inputDb + reduction + makeupDb;
  };
}

/** "120 Hz", "1.2 kHz", "12 kHz". */
export function formatHz(hz: number): string {
  if (hz >= 10_000) {
    return `${Math.round(hz / 1000)} kHz`;
  }
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}

/** "+3.0 dB", "-6.5 dB", "0.0 dB": a gain with its sign, never "-0.0". */
export function formatDb(db: number): string {
  const rounded = Math.abs(db) < 0.05 ? 0 : db;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} dB`;
}
