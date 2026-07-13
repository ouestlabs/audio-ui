const DEFAULT_HEIGHT = 100;
const DEFAULT_WIDTH = 800;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Decodes raw audio bytes (e.g. from `file.arrayBuffer()`) into one channel's PCM samples, ready for `downsampleWaveform`. Takes an existing `AudioContext`/`OfflineAudioContext` rather than creating its own, the same way `parseMidiFile` takes an already-read `ArrayBuffer` instead of fetching a URL itself — decoding is the caller's concern, this is just the audio-specific step. `decodeAudioData` can detach the buffer it's given in some browsers, hence the defensive copy. */
export async function decodeAudioSamples(
  context: BaseAudioContext,
  buffer: ArrayBuffer,
  channel = 0
): Promise<Float32Array> {
  const audioBuffer = await context.decodeAudioData(buffer.slice(0));
  const channelIndex = Math.min(channel, audioBuffer.numberOfChannels - 1);
  return audioBuffer.getChannelData(channelIndex);
}

/** Downsamples raw PCM samples into `targetLength` blocks, each block's value the average absolute amplitude within it — the standard block-average approach for waveform visualization (ported from jerosoler/waveform-path's `getFilterData`). */
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
    let sum = 0;
    for (let j = 0; j < blockSize; j += 1) {
      sum += Math.abs(samples[blockStart + j] ?? 0);
    }
    blocks.push(sum / blockSize);
  }
  return blocks;
}

/** Scales `values` so the largest entry becomes 1 — keeps a waveform's peak reaching full height regardless of the source audio's own loudness (ported from jerosoler/waveform-path's `getNormalizeData`). */
export function normalizeWaveform(values: number[]): number[] {
  const peak = Math.max(0, ...values);
  if (peak === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / peak);
}

export interface LinearWaveformPathOptions {
  /** Total rendered height — the path is vertically centered within it. */
  height?: number;
  /** Total rendered width, spread evenly across every value. */
  width?: number;
}

/**
 * Builds an SVG path `d` string tracing `values` (each expected in [0, 1] —
 * see `downsampleWaveform`/`normalizeWaveform`) left to right as a zigzag
 * line, for `Waveform.Path`/`Waveform.Progress` — a simplified,
 * single-template port of jerosoler/waveform-path's `linearPath` "steps"
 * type. For a discrete bar-chart look instead, see `waveformBars`.
 */
export function linearWaveformPath(
  values: number[],
  options: LinearWaveformPathOptions = {}
): string {
  const { height = DEFAULT_HEIGHT, width = DEFAULT_WIDTH } = options;
  const count = values.length;
  if (count === 0) {
    return "";
  }
  const stepWidth = width / count;
  const centerY = height / 2;
  const segments: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i + 0.5) * stepWidth;
    const sign = i % 2 === 0 ? 1 : -1;
    const y = centerY - sign * clampUnit(values[i] ?? 0) * centerY;
    segments.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  return segments.join(" ");
}

export interface WaveformBar {
  height: number;
  opacity: number;
  width: number;
  x: number;
  y: number;
}

export interface WaveformBarsOptions {
  /** Fraction of each bar's step reserved as the gap to its neighbor, in [0, 1) — mirrors the `barWidth`/`barGap` ratio common bar-chart waveform components (e.g. SoundCloud-style scrubbers) use. */
  gap?: number;
  /** Total rendered height — each bar rises symmetrically from its own vertical center. */
  height?: number;
  /** Total rendered width, spread evenly across every value. */
  width?: number;
}

const DEFAULT_BAR_GAP = 0.25;
const MIN_BAR_HEIGHT_RATIO = 0.02;
const MIN_OPACITY = 0.3;
const MAX_OPACITY_RANGE = 0.7;

/**
 * Lays out `values` (each expected in [0, 1] — see
 * `downsampleWaveform`/`normalizeWaveform`) as discrete rounded bars for
 * `Waveform.Bars`/`Waveform.BarsProgress` — each bar's height tracks its
 * amplitude and its opacity fades in with it too, the same visual language
 * voice-message/SoundCloud-style waveform scrubbers use. Positions are
 * plain data (no color, no rounding radius) — the primitive doesn't care
 * how they were produced.
 */
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
