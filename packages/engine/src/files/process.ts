import {
  highpass,
  lowpass,
  notch,
  process as processSection,
} from "@audio/biquad";
import noiseShaping from "@audio/effect-noiseshaper";
import { loudnessGain, measureLoudness } from "../analysis/loudness.ts";

const dbToGain = (db: number) => 10 ** (db / 20);

/** Every channel, `db` louder or quieter. */
export function gainChannels(
  channels: readonly Float32Array[],
  db: number
): Float32Array[] {
  const gain = dbToGain(db);
  return channels.map((channel) => channel.map((sample) => sample * gain));
}

/** What a sound is normalized to: its loudest sample, or its integrated loudness held under a true-peak ceiling. */
export type NormalizeTarget =
  | { peak: number }
  | { ceiling?: number; lufs: number };

/**
 * The sound, with one gain on every channel, so the balance between them
 * stays: to a peak in dBFS, or to a loudness in LUFS as far as its true peak
 * stays under `ceiling` (-1 dBTP by default). Silence comes back as it is.
 */
export function normalizeChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  target: NormalizeTarget
): Float32Array[] {
  const loudness = measureLoudness(channels, sampleRate);
  const db =
    "peak" in target
      ? target.peak - loudness.peak
      : loudnessGain(loudness, target.lufs, target.ceiling);
  return Number.isFinite(db) ? gainChannels(channels, db) : [...channels];
}

/**
 * A sound's balance: -1 is all left, 1 all right, 0 as it is. The side that
 * is turned away is attenuated and the other is left alone, so the centre
 * loses nothing. A mono sound becomes stereo to be placed; any other channel
 * count comes back as it is.
 */
export function panChannels(
  channels: readonly Float32Array[],
  pan: number
): Float32Array[] {
  const [first] = channels;
  const [left, right] =
    channels.length === 1 && first ? [first, first] : channels;
  if (!((channels.length === 1 || channels.length === 2) && left && right)) {
    return [...channels];
  }
  const at = Math.max(-1, Math.min(1, pan));
  const toLeft = at > 0 ? 1 - at : 1;
  const toRight = at < 0 ? 1 + at : 1;
  return [
    left.map((sample) => sample * toLeft),
    right.map((sample) => sample * toRight),
  ];
}

/** A filter's shape: what it lets through, 12 dB an octave. */
export type FilterType = "highpass" | "lowpass" | "notch";

/** Each filter's design, as a map: a type it does not hold finds nothing, not a function every object inherits. */
const DESIGNS = new Map<string, typeof lowpass>(
  Object.entries({ highpass, lowpass, notch } satisfies Record<
    FilterType,
    typeof lowpass
  >)
);

/**
 * Every channel through one filter of the cookbook, at `frequency` in hertz
 * and a `q` (one over the square root of two by default, the flattest). A
 * frequency at or over the Nyquist limit comes back as it is, and a type
 * other than `highpass`, `lowpass` or `notch` throws a `RangeError`.
 */
export function filterChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  { frequency, q, type }: { frequency: number; q?: number; type: FilterType }
): Float32Array[] {
  if (!(frequency > 0 && frequency < sampleRate / 2)) {
    return [...channels];
  }
  const design = DESIGNS.get(type);
  if (!design) {
    throw new RangeError(`There is no filter type called "${type}".`);
  }
  const coefficients = design(frequency, q, sampleRate);
  return channels.map((channel) => {
    const out = Float32Array.from(channel);
    processSection(out, coefficients);
    return out;
  });
}

/**
 * How a sound is brought to fewer bits: `tpdf` adds triangular noise one
 * step wide before rounding, so the error is steady noise instead of
 * distortion that follows the sound; `shaped` does the same with the error
 * fed back through two delays, which moves the noise up toward the highest
 * frequencies, where the ear hears it least; `feedback` rounds with the
 * error fed back once (`@audio/effect-noiseshaper`), with no added noise.
 */
export const DITHER_METHODS = ["tpdf", "shaped", "feedback"] as const;

export type DitherMethod = (typeof DITHER_METHODS)[number];

const triangular = () => Math.random() - Math.random();

/**
 * Every channel rounded to `bits` bits, by one of `DITHER_METHODS`, the way
 * a sound is mastered to 16 bits or 8: as many steps as that depth has, and
 * the error made into noise by the method. A source is not changed.
 */
export function ditherChannels(
  channels: readonly Float32Array[],
  bits: number,
  method: DitherMethod = "tpdf"
): Float32Array[] {
  const depth = Math.max(1, Math.min(24, Math.round(bits)));
  const levels = 2 ** (depth - 1) - 1;
  const step = 1 / levels;
  return channels.map((channel) => {
    const out = new Float32Array(channel.length);
    if (method === "feedback") {
      out.set(channel);
      return noiseShaping(out, { bits: depth }) as Float32Array;
    }
    // NTF = (1 - z^-1)^2: the error of the two samples before is taken off the next.
    let e1 = 0;
    let e2 = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const wanted =
        (channel[index] as number) - (method === "shaped" ? 2 * e1 - e2 : 0);
      const made = Math.round((wanted + triangular() * step) * levels) * step;
      out[index] = made;
      e2 = e1;
      e1 = made - wanted;
    }
    return out;
  });
}
