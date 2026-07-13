"use client";

import { Waveform as WaveformPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";
import type { WaveformBar } from "@/registry-audio/bases/base/lib/waveform-path";

const DEFAULT_VIEW_BOX = "0 0 800 100";

interface WaveformProps extends WaveformPrimitive.RootProps {
  bars: WaveformBar[];
  variant?: "default" | "playhead";
  viewBox?: string;
}

export function Waveform({
  bars,
  className,
  variant = "default",
  viewBox = DEFAULT_VIEW_BOX,
  ...props
}: WaveformProps) {
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
          <WaveformPrimitive.Bars bars={bars} className="cn-waveform-bars" />
          <WaveformPrimitive.BarsProgress
            bars={bars}
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
