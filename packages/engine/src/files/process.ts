import {
  highpass,
  lowpass,
  notch,
  process as processSection,
} from "@audio/biquad";
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

const DESIGNS = { highpass, lowpass, notch } as const;

/**
 * Every channel through one filter of the cookbook, at `frequency` in hertz
 * and a `q` (one over the square root of two by default, the flattest). A
 * frequency at or over the Nyquist limit comes back as it is.
 */
export function filterChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  { frequency, q, type }: { frequency: number; q?: number; type: FilterType }
): Float32Array[] {
  if (!(frequency > 0 && frequency < sampleRate / 2)) {
    return [...channels];
  }
  const coefficients = DESIGNS[type](frequency, q, sampleRate);
  return channels.map((channel) => {
    const out = Float32Array.from(channel);
    processSection(out, coefficients);
    return out;
  });
}
