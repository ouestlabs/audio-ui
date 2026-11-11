/**
 * Exporting sound to a file: the settings an export picks, and the steps from
 * rendered channels to the file, measured, brought to a peak or a loudness,
 * then encoded. What `export-dialog` asks for and a render gives.
 */
import {
  dbToGain,
  type Loudness,
  loudnessGain,
  measureLoudness,
} from "@audio-ui/engine/analysis";
import { type AudioFileFormat, encodeAudio } from "@audio-ui/engine/files";

/** How an export is brought to a level: left as it is, its loudest sample to 0 dBFS, or to a loudness in LUFS with its true peak at -1 dBTP at most. */
export type ExportNormalize = "off" | "peak" | number;

export interface ExportSettings {
  /** WAV and FLAC: 16 or 24 bits, or 32-bit floats for a WAV. */
  bitDepth: 16 | 24 | 32;
  /** MP3, in kbps. */
  bitrate: number;
  format: AudioFileFormat;
  normalize: ExportNormalize;
}

/** A 24-bit WAV, left at its level; an MP3 at 320 kbps once picked. */
export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  bitDepth: 24,
  bitrate: 320,
  format: "wav",
  normalize: "off",
};

/** What an export is doing, for a progress readout. */
export type ExportStage = "encoding" | "measuring";

export interface ExportedSound {
  file: Blob;
  /** The gain the level was brought by, in dB: 0 when left as it is. */
  gain: number;
  /** How loud the file is, its gain included. */
  loudness: Loudness;
}

/** Lets the page paint its progress readout before the measure keeps it waiting. */
const paint = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(resolve));
    } else {
      setTimeout(resolve);
    }
  });

/** The gain in dB that `normalize` asks of a sound this loud. */
function normalizeGain(loudness: Loudness, normalize: ExportNormalize) {
  if (normalize === "off") {
    return 0;
  }
  if (normalize === "peak") {
    return Number.isFinite(loudness.peak) ? -loudness.peak : 0;
  }
  return loudnessGain(loudness, normalize);
}

/**
 * Turns rendered channels into a file of `settings`, saying how far it is
 * through `onProgress`: first measured (the page waits about half a second a
 * minute of stereo), then encoded in chunks.
 */
export async function exportSound(
  channels: readonly Float32Array[],
  sampleRate: number,
  settings: ExportSettings,
  onProgress?: (stage: ExportStage, done: number) => void
): Promise<ExportedSound> {
  onProgress?.("measuring", 0);
  await paint();
  const measured = measureLoudness(channels, sampleRate);
  const gain = normalizeGain(measured, settings.normalize);
  const scale = dbToGain(gain);
  const file = await encodeAudio(
    gain === 0
      ? channels
      : channels.map((channel) => channel.map((sample) => sample * scale)),
    {
      bitDepth: settings.bitDepth,
      bitrate: settings.bitrate,
      format: settings.format,
      onProgress: (done) => onProgress?.("encoding", done),
      sampleRate,
    }
  );
  return {
    file,
    gain,
    loudness: {
      lufs: measured.lufs + gain,
      peak: measured.peak + gain,
      truePeak: measured.truePeak + gain,
    },
  };
}
