/**
 * Framework-free waveform DSP: decode raw audio bytes into samples, then
 * reduce them to the Waveform's `values` — the lowest and highest sample of
 * each slice (`computePeaks`), or one amplitude per slice
 * (`downsampleWaveform`); and reduce a live analyser's spectrum to frequency
 * bands. Pure and audio-only, so it stays off any `"use client"`
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

/** Decodes raw audio bytes into every channel's PCM samples, ready for `computePeaks`. Like `decodeAudioSamples`, it takes the caller's context and decodes a copy of the bytes. */
export async function decodeAudioChannels(
  context: BaseAudioContext,
  buffer: ArrayBuffer
): Promise<Float32Array[]> {
  const audioBuffer = await context.decodeAudioData(buffer.slice(0));
  return Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) =>
    audioBuffer.getChannelData(channel)
  );
}

/** The lowest and highest sample of each slice of the audio, -1 to 1: what the Waveform draws as the waveform really is, lopsided where the audio is. */
export interface AudioPeaks {
  max: Float32Array;
  min: Float32Array;
}

/** Reduces PCM samples to `bucketCount` slices, keeping each slice's lowest and highest sample across every channel — a take panned hard to one side still draws, rather than reading as a flat line on the channel it isn't on. Compute it once per file, at a resolution above the widest waveform you expect (a few thousand slices); the Waveform fits it to its width and to any `range`. */
export function computePeaks(
  channels: readonly ArrayLike<number>[],
  bucketCount: number
): AudioPeaks {
  const count = Math.max(0, Math.floor(bucketCount));
  const min = new Float32Array(count);
  const max = new Float32Array(count);
  const length = Math.max(0, ...channels.map((channel) => channel.length));
  if (count === 0 || length === 0) {
    return { max, min };
  }
  for (let bucket = 0; bucket < count; bucket += 1) {
    const start = Math.floor((bucket * length) / count);
    const end = Math.max(
      start + 1,
      Math.floor(((bucket + 1) * length) / count)
    );
    let low = 0;
    let high = 0;
    for (const channel of channels) {
      for (
        let index = start;
        index < end && index < channel.length;
        index += 1
      ) {
        const sample = channel[index] ?? 0;
        low = Math.min(low, sample);
        high = Math.max(high, sample);
      }
    }
    min[bucket] = low;
    max[bucket] = high;
  }
  return { max, min };
}

/** Scales peaks so the loudest sample, either way, reaches full height, keeping each slice's lopsidedness. */
export function normalizePeaks(peaks: AudioPeaks): AudioPeaks {
  let loudest = 0;
  for (const value of peaks.max) {
    loudest = Math.max(loudest, Math.abs(value));
  }
  for (const value of peaks.min) {
    loudest = Math.max(loudest, Math.abs(value));
  }
  if (loudest === 0) {
    return peaks;
  }
  return {
    max: peaks.max.map((value) => value / loudest),
    min: peaks.min.map((value) => value / loudest),
  };
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
