/**
 * Framework-free waveform DSP: decode raw audio bytes into one channel's
 * samples, reduce those samples to a fixed number of amplitude values, and lay
 * them out as bars for rendering. Pure and audio-only — the styled Waveform
 * element and the player block both stand on it, so it stays off any
 * `"use client"` surface. (Formerly inlined in `audio/elements/waveform.tsx`;
 * moved here so the element is appearance-only.)
 */

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 100;
const DEFAULT_BAR_GAP = 0.25;
const MIN_BAR_HEIGHT_RATIO = 0.02;
const MIN_OPACITY = 0.3;
const MAX_OPACITY_RANGE = 0.7;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

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

export interface WaveformBar {
  height: number;
  opacity: number;
  width: number;
  x: number;
  y: number;
}

export interface WaveformBarsOptions {
  gap?: number;
  height?: number;
  width?: number;
}

/** Lays out `values` (each expected in [0, 1] — see `downsampleWaveform`/`normalizeWaveform`) as discrete rounded bars — each bar's height tracks its amplitude and its opacity fades in with it too, the same visual language voice-message/SoundCloud-style waveform scrubbers use. */
export function waveformBars(
  values: number[],
  options: WaveformBarsOptions = {}
): WaveformBar[] {
  const {
    gap = DEFAULT_BAR_GAP,
    height = DEFAULT_HEIGHT,
    width = DEFAULT_WIDTH,
  } = options;
  const count = values.length;
  if (count === 0) {
    return [];
  }
  const step = width / count;
  const barWidth = step * (1 - gap);
  return values.map((value, i) => {
    const clamped = clampUnit(value);
    const barHeight = Math.max(height * MIN_BAR_HEIGHT_RATIO, clamped * height);
    return {
      height: barHeight,
      opacity: MIN_OPACITY + clamped * MAX_OPACITY_RANGE,
      width: barWidth,
      x: i * step + (step - barWidth) / 2,
      y: (height - barHeight) / 2,
    };
  });
}
