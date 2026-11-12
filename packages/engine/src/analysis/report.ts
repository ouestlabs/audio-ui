import { detectKeys } from "../pitch/key.ts";
import type { Scale } from "../pitch/scale.ts";
import { peakDb, rmsDb } from "./level.ts";
import { type Loudness, measureLoudness } from "./loudness.ts";
import { analyzeBeat, audioChroma } from "./recording.ts";
import { detectSilences } from "./silence.ts";

/** What ACX asks of an audiobook: the RMS between -23 and -18 dBFS, the peak at most -3 dBFS, the noise floor at most -60 dBFS RMS. */
export const ACX = {
  maxNoiseFloor: -60,
  maxPeak: -3,
  maxRms: -18,
  minRms: -23,
} as const;

/** One requirement and how the sound stands against it. */
export interface AcxCheck {
  pass: boolean;
  /** The measured level in dB, or `null` when the sound has nothing to measure it on. */
  value: number | null;
}

/** A sound against the ACX audiobook requirements. */
export interface AcxReport {
  /** The level of the quietest pause of at least half a second, in dBFS RMS: `null` for a sound with no such pause. */
  noiseFloor: AcxCheck;
  pass: boolean;
  peak: AcxCheck;
  rms: AcxCheck;
}

/** The RMS of every channel together, in dBFS: the power of each averaged. */
function rmsAll(channels: readonly Float32Array[]): number {
  if (channels.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  const power =
    channels.reduce((sum, channel) => sum + 10 ** (rmsDb(channel) / 10), 0) /
    channels.length;
  return power > 0 ? 10 * Math.log10(power) : Number.NEGATIVE_INFINITY;
}

/**
 * Checks a sound against ACX's requirements for an audiobook. The noise floor
 * is read on the quietest pause of at least half a second: a sound with none
 * cannot be measured, and does not pass.
 */
export function checkAcx(
  channels: readonly Float32Array[],
  sampleRate: number
): AcxReport {
  const rms = rmsAll(channels);
  const peak = Math.max(
    Number.NEGATIVE_INFINITY,
    ...channels.map((channel) => peakDb(channel))
  );
  let floor: number | null = null;
  for (const [from, to] of detectSilences(channels, sampleRate, {
    minDuration: 0.5,
  })) {
    const level = rmsAll(
      channels.map((channel) =>
        channel.subarray(
          Math.floor(from * sampleRate),
          Math.ceil(to * sampleRate)
        )
      )
    );
    floor = floor === null ? level : Math.min(floor, level);
  }
  const report = {
    noiseFloor: {
      pass: floor !== null && floor <= ACX.maxNoiseFloor,
      value: floor,
    },
    peak: { pass: peak <= ACX.maxPeak, value: peak },
    rms: { pass: rms >= ACX.minRms && rms <= ACX.maxRms, value: rms },
  };
  return {
    ...report,
    pass: report.noiseFloor.pass && report.peak.pass && report.rms.pass,
  };
}

/** What `reportSound` reads from a sound. */
export interface SoundReport {
  acx: AcxReport;
  duration: number;
  /** The likeliest key, or `null` for a sound with too little pitched content. */
  key: Scale | null;
  loudness: Loudness;
  /** The tempo in beats a minute, or `null` for a sound with no beat. */
  tempo: number | null;
}

/**
 * Reads a sound once, to tell what it is: its loudness, its key, its tempo,
 * and whether it meets ACX's requirements. It reads every sample, a few
 * seconds a minute of stereo on a laptop, so call it where the page can wait.
 */
export function reportSound(
  channels: readonly Float32Array[],
  sampleRate: number
): SoundReport {
  const [key] = detectKeys([], 1, audioChroma(channels, sampleRate));
  return {
    acx: checkAcx(channels, sampleRate),
    duration: (channels[0]?.length ?? 0) / sampleRate,
    key: key ?? null,
    loudness: measureLoudness(channels, sampleRate),
    tempo: analyzeBeat(channels, sampleRate).estimate?.bpm ?? null,
  };
}
