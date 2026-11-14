import { pitchShift } from "@audio/shift";
import {
  hybrid,
  paulstretch,
  pvocLock,
  pvsola,
  transient,
  wsola,
} from "@audio/stretch";
import { resampleChannels } from "./channels.ts";

/**
 * The ways a sound is stretched in time with its pitch kept, each with what
 * it suits: a phase vocoder that keeps the attacks of drums (`transient`),
 * one for general music (`pvocLock`), waveform overlap-add for speech made
 * shorter (`wsola`) or longer (`pvsola`), a vocoder with the harmonic and
 * percussive parts apart for full mixes (`hybrid`), and the extreme
 * stretch of ambient textures (`paulstretch`).
 */
export const STRETCH_METHODS = [
  "transient",
  "pvocLock",
  "wsola",
  "pvsola",
  "hybrid",
  "paulstretch",
] as const;

export type StretchMethod = (typeof STRETCH_METHODS)[number];

type Options = { factor: number; sampleRate: number };
type Together = (data: Float32Array[], options: Options) => Float32Array[];
type Apart = (data: Float32Array, options: Options) => Float32Array;

/** `wsola` takes every channel at once and shares one search, so the channels stay in phase. */
const together: Together = (data, options) => wsola(data, options);

/** The others take one channel at a time: a map, so a name it does not hold finds nothing, not a function every object inherits. */
const APART = new Map<string, Apart>(
  Object.entries({
    hybrid: (data, options) => hybrid(data, options),
    paulstretch: (data, options) => paulstretch(data, options),
    pvocLock: (data, options) => pvocLock(data, options),
    pvsola: (data, options) => pvsola(data, options),
    transient: (data, options) => transient(data, options),
  } satisfies Record<Exclude<StretchMethod, "wsola">, Apart>)
);

/**
 * Every channel `factor` times as long, its pitch unchanged: 2 is twice as
 * slow, 0.5 twice as fast. The channels share one analysis where the method
 * allows it (`wsola`), so they stay in phase; the other methods take them
 * one by one. A method not in `STRETCH_METHODS` throws a `RangeError`.
 */
export function stretchChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  { factor, method = "transient" }: { factor: number; method?: StretchMethod }
): Float32Array[] {
  if (!(factor > 0) || factor === 1 || channels.length === 0) {
    return [...channels];
  }
  const options: Options = { factor, sampleRate };
  if (method === "wsola") {
    return together([...channels], options);
  }
  const apart = APART.get(method);
  if (typeof apart !== "function") {
    throw new RangeError(`There is no stretch method called "${method}".`);
  }
  // Called here, where the check above holds, not in a callback.
  const stretched: Float32Array[] = [];
  for (const channel of channels) {
    stretched.push(apart(channel, options));
  }
  return stretched;
}

/** How a pitch is shifted: let the library choose from the sound (`auto`), or a method by name. */
export const SHIFT_METHODS = [
  "auto",
  "transient",
  "phaseLock",
  "formant",
  "wsola",
  "psola",
] as const;

export type ShiftMethod = (typeof SHIFT_METHODS)[number];

/**
 * Every channel `semitones` higher or lower, its length unchanged. `formant`
 * keeps a voice's character, where the others move it with the pitch.
 */
export function shiftChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  { method = "auto", semitones }: { method?: ShiftMethod; semitones: number }
): Float32Array[] {
  if (semitones === 0 || channels.length === 0) {
    return [...channels];
  }
  return pitchShift([...channels], {
    method: method === "auto" ? undefined : method,
    sampleRate,
    semitones,
  });
}

/**
 * The sound played `speed` times as fast, its pitch moving with it as on a
 * tape or a record: 2 is twice as fast and an octave up. The sample rate
 * stays, the length changes.
 */
export function speedChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  speed: number
): Float32Array[] {
  if (!(speed > 0) || speed === 1) {
    return [...channels];
  }
  return resampleChannels(channels, sampleRate * speed, sampleRate);
}
