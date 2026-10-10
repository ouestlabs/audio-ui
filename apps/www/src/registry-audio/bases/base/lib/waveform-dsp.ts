/**
 * Framework-free waveform DSP: decode raw audio bytes into one channel's
 * samples, then reduce those samples to a fixed number of amplitude values
 * for the Waveform's `values`; and reduce a live analyser's spectrum to
 * frequency bands. Pure and audio-only, so it stays off any `"use client"`
 * surface; the Waveform itself fits the values to its width.
 */

/** Decodes raw audio bytes (e.g. from `file.arrayBuffer()`) into one channel's PCM samples, ready for `downsampleWaveform`. Takes an existing `AudioContext`/`OfflineAudioContext` rather than creating its own — decoding is the caller's concern, this is just the audio-specific step. `decodeAudioData` can detach the buffer it's given in some browsers, hence the defensive copy. */
export async function decodeAudioSamples(
  context: BaseAudioContext,
  buffer: ArrayBuffer,
  channel = 0
): Promise<Float32Array> {
  const audioBuffer = await context.decodeAudioData(buffer.slice(0));
  const channelIndex = Math.min(channel, audioBuffer.numberOfChannels - 1);
  return audioBuffer.getChannelData(channelIndex);
}

/** Downsamples raw PCM samples into `targetLength` blocks, each block's value the peak (max) absolute amplitude within it — the reduction wavesurfer.js/audiowaveform-style waveform visualizers use, since a block average flattens short transients into a softer-looking curve than the audio actually has. */
export function downsampleWaveform(
  samples: ArrayLike<number>,
  targetLength: number
): number[] {
  if (targetLength <= 0 || samples.length === 0) {
    return [];
  }
  const blockSize = Math.max(1, Math.floor(samples.length / targetLength));
  const blocks: number[] = [];
  for (let i = 0; i < targetLength; i += 1) {
    const blockStart = i * blockSize;
    let peak = 0;
    for (let j = 0; j < blockSize; j += 1) {
      const value = Math.abs(samples[blockStart + j] ?? 0);
      if (value > peak) {
        peak = value;
      }
    }
    blocks.push(peak);
  }
  return blocks;
}

/** Scales `values` so the largest entry becomes 1 — keeps a waveform's peak reaching full height regardless of the source audio's own loudness. */
export function normalizeWaveform(values: number[]): number[] {
  const peak = Math.max(0, ...values);
  if (peak === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / peak);
}

export interface SpectrumBandsOptions {
  /** The level drawn as 1, in decibels: `AnalyserNode.maxDecibels`. @default -30 */
  maxDb?: number;
  /** Highest frequency of the last band, in Hz. @default 12000 */
  maxHz?: number;
  /** The level drawn as 0, in decibels: `AnalyserNode.minDecibels`. @default -100 */
  minDb?: number;
  /** Lowest frequency of the first band, in Hz. @default 60 */
  minHz?: number;
  /** Sample rate of the audio the spectrum was taken from, in Hz. */
  sampleRate: number;
}

/** Reduces an analyser's spectrum (`getFloatFrequencyData`: decibels per frequency bin) to `bands.length` levels of 0-1, low to high, written into `bands`. Bands are spaced evenly on a log scale between `minHz` and `maxHz` — the way pitch is heard, so the low end isn't crammed into one bar — and each takes its loudest bin, so a single note still lights its band. */
export function spectrumBands(
  spectrum: ArrayLike<number>,
  bands: Float32Array,
  {
    maxDb = -30,
    maxHz = 12_000,
    minDb = -100,
    minHz = 60,
    sampleRate,
  }: SpectrumBandsOptions
): Float32Array {
  const binCount = spectrum.length;
  if (binCount === 0 || sampleRate <= 0) {
    return bands.fill(0);
  }
  const hzPerBin = sampleRate / 2 / binCount;
  const octaves = Math.log2(Math.max(maxHz, minHz + 1) / minHz);
  for (let band = 0; band < bands.length; band += 1) {
    const lowHz = minHz * 2 ** ((octaves * band) / bands.length);
    const highHz = minHz * 2 ** ((octaves * (band + 1)) / bands.length);
    const first = Math.min(binCount - 1, Math.floor(lowHz / hzPerBin));
    const last = Math.min(
      binCount,
      Math.max(first + 1, Math.ceil(highHz / hzPerBin))
    );
    let loudestDb = minDb;
    for (let bin = first; bin < last; bin += 1) {
      loudestDb = Math.max(loudestDb, spectrum[bin] ?? minDb);
    }
    bands[band] = Math.min(1, (loudestDb - minDb) / (maxDb - minDb));
  }
  return bands;
}
