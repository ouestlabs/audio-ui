"use client";

import { Waveform as WaveformPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";

/** Matches `linearWaveformPath`'s own default width/height, so a `viewBox` "just works" when the path was generated with defaults. */
const DEFAULT_VIEW_BOX = "0 0 800 100";

interface WaveformProps extends WaveformPrimitive.RootProps {
  /** The waveform's SVG path `d` string — see `linearWaveformPath` in `lib/waveform-path.ts`. Rendered twice internally: the full shape, and a value-clipped "progress" copy. */
  d: string;
  viewBox?: string;
}

export function Waveform({
  className,
  d,
  viewBox = DEFAULT_VIEW_BOX,
  ...props
}: WaveformProps) {
  return (
    <WaveformPrimitive.Root className="w-full min-w-0" {...props}>
      <WaveformPrimitive.Track
        className={cn(
          "cn-waveform relative w-full min-w-0 touch-none select-none",
          "focus-within:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
          className
        )}
        data-slot="waveform"
      >
        <WaveformPrimitive.Svg viewBox={viewBox}>
          <WaveformPrimitive.Path className="cn-waveform-path" d={d} />
          <WaveformPrimitive.Progress className="cn-waveform-progress" d={d} />
        </WaveformPrimitive.Svg>
        <WaveformPrimitive.Thumb className="cn-waveform-thumb" />
      </WaveformPrimitive.Track>
    </WaveformPrimitive.Root>
  );
}
