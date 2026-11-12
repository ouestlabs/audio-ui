import { dbToGain, gainToDb } from "./level.ts";

/** Frames a block of the scan holds: a pause is found to one of them. */
const BLOCK = 1024;
/** The loudest a pause gets, as a waveform's ground drawn flat at any zoom but the closest, in dBFS. */
const GROUND_DB = gainToDb(0.02);
/** How far under the loudest sample a quiet recording's pauses are, in dB. */
const UNDER_PEAK_DB = 20;
/** The shortest pause, in seconds: a gap between two sounds of a phrase is shorter. */
const SHORTEST = 0.06;

/** What `detectSilences` takes, both optional. */
export interface SilenceOptions {
  /** The shortest stretch that counts as a pause, in seconds. @default 0.06 */
  minDuration?: number;
  /** The loudest a sample of a pause gets, in dBFS. @default -34 dBFS, or 20 dB under the loudest sample when that is lower */
  threshold?: number;
}

/** The loudest sample of each block, across the channels, and of them all. */
function blockPeaks(channels: readonly Float32Array[], length: number) {
  const loudest = new Float32Array(Math.ceil(length / BLOCK));
  let peak = 0;
  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) {
      const level = Math.abs(channel[index] as number);
      const block = Math.floor(index / BLOCK);
      if (level > (loudest[block] as number)) {
        loudest[block] = level;
      }
      peak = Math.max(peak, level);
    }
  }
  return { loudest, peak };
}

/**
 * Where `channels` pause between their sounds, as `[from, to]` in seconds, in
 * order: each stretch of at least `minDuration` where every sample of every
 * channel stays under the threshold, found to a block of 1024 frames. As a
 * text's spaces between its words, these are what a selection by sound
 * stops at.
 */
export function detectSilences(
  channels: readonly Float32Array[],
  sampleRate: number,
  options: SilenceOptions = {}
): [number, number][] {
  const length = channels[0]?.length ?? 0;
  if (length === 0 || !(sampleRate > 0)) {
    return [];
  }
  const { loudest, peak } = blockPeaks(channels, length);
  const blocks = loudest.length;
  const threshold = dbToGain(
    options.threshold ?? Math.min(GROUND_DB, gainToDb(peak) - UNDER_PEAK_DB)
  );
  const shortest = options.minDuration ?? SHORTEST;
  const found: [number, number][] = [];
  let start: number | null = null;
  for (let block = 0; block <= blocks; block += 1) {
    const quiet = block < blocks && (loudest[block] as number) <= threshold;
    if (quiet && start === null) {
      start = block;
    } else if (!quiet && start !== null) {
      const from = (start * BLOCK) / sampleRate;
      const to = Math.min(block * BLOCK, length) / sampleRate;
      if (to - from >= shortest) {
        found.push([from, to]);
      }
      start = null;
    }
  }
  return found;
}
