/**
 * What a filter and an equalizer do to a signal, as the curve a plot draws: a
 * gain in dB at each frequency. Framework-agnostic and drawn from the formulas
 * an audio engine runs, the biquads of the RBJ "Audio EQ Cookbook", which the
 * Web Audio `BiquadFilterNode` implements: the curve equals the node's
 * `getFrequencyResponse` to rounding (checked against Chrome's, every type, Q
 * from 0.5 to 4), once `q` is passed to the node through `toWebAudioQ`.
 *
 * `q` is the cookbook's: linear, 1/sqrt(2) being the flat Butterworth. The node
 * reads it differently for two kinds of band, which `toWebAudioQ` and the
 * shelves below account for. The sample rate only decides where the top of the
 * curve bends toward Nyquist: 48 kHz is close enough for a picture (a 44.1 kHz
 * context differs by under 0.6 dB, at the very top), and a band can carry the
 * `sampleRate` of its context, such as `ctx.sampleRate`, to be exact.
 */

/** The sample rate a curve is drawn at unless a band says another. */
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

/** The Web Audio `BiquadFilterNode` type that does what each band type draws. */
export const WEB_AUDIO_FILTER_TYPES: Record<BiquadType, BiquadFilterType> = {
  bandpass: "bandpass",
  highcut: "lowpass",
  highshelf: "highshelf",
  lowcut: "highpass",
  lowshelf: "lowshelf",
  notch: "notch",
  peak: "peaking",
};

/**
 * The value to give a `BiquadFilterNode`'s `Q` for a band's `q`. The node takes
 * the Q of a low-pass or high-pass in decibels (`lowcut` and `highcut` here),
 * and a linear one for the other types, so `q` is converted for those two:
 * giving a `lowcut` of `q: 2` a `Q` of 2 would make it 2 dB, and the curve on
 * screen would not be the filter you hear. A shelf ignores Q in the node, and
 * so does its curve.
 */
export function toWebAudioQ(type: BiquadType, q = Math.SQRT1_2): number {
  if (type === "lowcut" || type === "highcut") {
    return 20 * Math.log10(Math.max(q, MIN_Q));
  }
  return q;
}

export interface BiquadSettings {
  frequency: number;
  /** Gain in dB: used by peaks and shelves, ignored by the rest. */
  gainDb?: number;
  /** The cookbook's Q, linear: 1/sqrt(2) is flat. Shelves have a fixed slope and ignore it. Pass it to a node with `toWebAudioQ`. @default Math.SQRT1_2 */
  q?: number;
  /** The sample rate the curve is drawn at, such as `ctx.sampleRate`. @default 48000 */
  sampleRate?: number;
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
  q: requestedQ = Math.SQRT1_2,
  sampleRate = SAMPLE_RATE,
  type,
}: BiquadSettings): Coefficients {
  // A shelf has the slope of 1 the Web Audio spec gives it, whatever the Q.
  const q =
    type === "lowshelf" || type === "highshelf" ? Math.SQRT1_2 : requestedQ;
  const w0 =
    (2 * Math.PI * clamp(frequency, 10, sampleRate * NYQUIST_SHARE)) /
    sampleRate;
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
  const sampleRate = settings.sampleRate ?? SAMPLE_RATE;
  return (hz) => {
    const omega = (2 * Math.PI * hz) / sampleRate;
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

/** A gain big enough to measure a band's effect at its own frequency without noise. */
const PROBE_DB = 12;

/**
 * Where a band's handle sits on an equalizer's curve: the response of all
 * the bands at the band's own frequency. A peak's handle is at its gain; a
 * shelf's is halfway up its slope; and other bands' reach adds to both.
 */
export function bandHandleDb(bands: readonly EqBand[], index: number): number {
  const band = bands[index];
  return band ? eqResponse(bands)(band.frequency) : 0;
}

/**
 * The inverse, for dragging: the gain a band needs at `frequency` for its
 * handle to sit at `responseDb` on the curve, so the handle follows the
 * pointer one to one instead of the gain drifting from it. A band that does
 * not take a gain (a cut, a notch) keeps the one it has.
 */
export function bandGainForHandle(
  bands: readonly EqBand[],
  index: number,
  frequency: number,
  responseDb: number
): number {
  const band = bands[index];
  if (!band) {
    return 0;
  }
  const others = eqResponse(bands.filter((_, at) => at !== index))(frequency);
  const share =
    biquadResponse({ ...band, frequency, gainDb: PROBE_DB })(frequency) /
    PROBE_DB;
  const own = biquadResponse({ ...band, frequency, gainDb: 0 })(frequency);
  if (Math.abs(share - own / PROBE_DB) < 0.05) {
    return band.gainDb ?? 0;
  }
  return (responseDb - others - own) / (share - own / PROBE_DB);
}
