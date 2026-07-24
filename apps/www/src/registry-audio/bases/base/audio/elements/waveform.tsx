"use client";

import { Waveform as WaveformPrimitive } from "@audio-ui/react";
import { useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  type WaveformBar,
  waveformBars,
} from "@/registry-audio/bases/base/lib/waveform-dsp";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 100;
const DEFAULT_VIEW_BOX = `0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`;
const WHITESPACE_PATTERN = /\s+/;

function parseViewBoxSize(viewBox: string): { height: number; width: number } {
  const [, , width, height] = viewBox
    .trim()
    .split(WHITESPACE_PATTERN)
    .map(Number);
  return { height: height || DEFAULT_HEIGHT, width: width || DEFAULT_WIDTH };
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

export { Waveform };
