"use client";

import { Waveform as WaveformPrimitive } from "@audio-ui/react";
import { useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 100;
const DEFAULT_VIEW_BOX = `0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`;
const WHITESPACE_PATTERN = /\s+/;
const DEFAULT_BAR_GAP = 0.25;
const MIN_BAR_HEIGHT_RATIO = 0.02;
const MIN_OPACITY = 0.3;
const MAX_OPACITY_RANGE = 0.7;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseViewBoxSize(viewBox: string): { height: number; width: number } {
  const [, , width, height] = viewBox
    .trim()
    .split(WHITESPACE_PATTERN)
    .map(Number);
  return { height: height || DEFAULT_HEIGHT, width: width || DEFAULT_WIDTH };
}

/** Decodes raw audio bytes (e.g. from `file.arrayBuffer()`) into one channel's PCM samples, ready for `downsampleWaveform`. Takes an existing `AudioContext`/`OfflineAudioContext` rather than creating its own — decoding is the caller's concern, this is just the audio-specific step. `decodeAudioData` can detach the buffer it's given in some browsers, hence the defensive copy. */
async function decodeAudioSamples(
  context: BaseAudioContext,
  buffer: ArrayBuffer,
  channel = 0
): Promise<Float32Array> {
  const audioBuffer = await context.decodeAudioData(buffer.slice(0));
  const channelIndex = Math.min(channel, audioBuffer.numberOfChannels - 1);
  return audioBuffer.getChannelData(channelIndex);
}

/** Downsamples raw PCM samples into `targetLength` blocks, each block's value the peak (max) absolute amplitude within it — the reduction wavesurfer.js/audiowaveform-style waveform visualizers use, since a block average flattens short transients into a softer-looking curve than the audio actually has. */
function downsampleWaveform(
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
function normalizeWaveform(values: number[]): number[] {
  const peak = Math.max(0, ...values);
  if (peak === 0) {
    return values.map(() => 0);
  }
  return values.map((value) => value / peak);
}

interface WaveformBar {
  height: number;
  opacity: number;
  width: number;
  x: number;
  y: number;
}

interface WaveformBarsOptions {
  gap?: number;
  height?: number;
  width?: number;
}

/** Lays out `values` (each expected in [0, 1] — see `downsampleWaveform`/`normalizeWaveform`) as discrete rounded bars — each bar's height tracks its amplitude and its opacity fades in with it too, the same visual language voice-message/SoundCloud-style waveform scrubbers use. */
function waveformBars(
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

type WaveformDataProps =
  | { bars: WaveformBar[]; values?: undefined }
  | { bars?: undefined; values: number[] };

type WaveformProps = WaveformPrimitive.RootProps &
  WaveformDataProps & {
    variant?: "default" | "playhead";
    viewBox?: string;
  };

function Waveform({
  bars,
  values,
  className,
  variant = "default",
  viewBox = DEFAULT_VIEW_BOX,
  ...props
}: WaveformProps) {
  const { width, height } = parseViewBoxSize(viewBox);
  const resolvedBars = useMemo(
    () => bars ?? waveformBars(values ?? [], { height, width }),
    [bars, values, height, width]
  );

  return (
    <WaveformPrimitive.Root
      className="w-full min-w-0 data-[disabled=true]:cursor-not-allowed"
      {...props}
    >
      <WaveformPrimitive.Track
        className={cn(
          "cn-waveform relative w-full min-w-0 cursor-pointer touch-none select-none overflow-hidden py-1",
          "focus-within:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
          className
        )}
        data-slot="waveform"
      >
        <WaveformPrimitive.Svg
          className="[-webkit-mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
          viewBox={viewBox}
        >
          <WaveformPrimitive.Bars
            bars={resolvedBars}
            className="cn-waveform-bars"
          />
          <WaveformPrimitive.BarsProgress
            bars={resolvedBars}
            className="cn-waveform-bars-progress"
          />
        </WaveformPrimitive.Svg>
        {variant === "playhead" && (
          <>
            <WaveformPrimitive.Playhead className="cn-waveform-playhead" />
            <WaveformPrimitive.Thumb className="cn-waveform-thumb" />
          </>
        )}
      </WaveformPrimitive.Track>
    </WaveformPrimitive.Root>
  );
}

export {
  decodeAudioSamples,
  downsampleWaveform,
  normalizeWaveform,
  Waveform,
  type WaveformBar,
};
