import lufs from "@audio/loudness-lufs";
import truepeak from "@audio/loudness-truepeak";
import { peakDb } from "@audio-ui/core/analysis";

/** Targets in LUFS: what streaming services, podcasts and broadcast (EBU R 128) ask a file to be. */
export const LOUDNESS_TARGETS = {
  broadcast: -23,
  podcast: -16,
  streaming: -14,
} as const;

/** How loud a sound is. Each is `-Infinity` for silence. */
export interface Loudness {
  /** Integrated loudness, in LUFS: over the whole sound, its quiet passages gated out. */
  lufs: number;
  /** The loudest sample, in dBFS. */
  peak: number;
  /** The loudest point of the waveform between the samples too, in dBTP: what a converter may play past full scale. */
  truePeak: number;
}

/**
 * Measures whole channels at once. It reads every sample, the true peak at
 * four points a sample: about half a second a minute of loud stereo on a
 * laptop, so call it where the page can wait, as an export does.
 */
export function measureLoudness(
  channels: readonly Float32Array[],
  sampleRate: number
): Loudness {
  if (channels.length === 0) {
    return {
      lufs: Number.NEGATIVE_INFINITY,
      peak: Number.NEGATIVE_INFINITY,
      truePeak: Number.NEGATIVE_INFINITY,
    };
  }
  return {
    lufs: lufs([...channels], { fs: sampleRate }) ?? Number.NEGATIVE_INFINITY,
    peak: Math.max(...channels.map((channel) => peakDb(channel))),
    truePeak: truepeak([...channels], { fs: sampleRate }),
  };
}

/**
 * The gain in dB that brings a sound to `target` LUFS, as far as its true
 * peak stays at or under `ceiling` dBTP: a sound that would pass it lands
 * under the target instead, and nothing is limited. 0 for silence.
 */
export function loudnessGain(
  loudness: Loudness,
  target: number,
  ceiling = -1
): number {
  if (!Number.isFinite(loudness.lufs)) {
    return 0;
  }
  return Math.min(target - loudness.lufs, ceiling - loudness.truePeak);
}