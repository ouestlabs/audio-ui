"use client";

import { Ruler as RulerPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";

/** Mirrors the primitive's own default step count, used only to size the decorative marks when neither value nor defaultValue is passed. */
const DEFAULT_TOTAL_STEPS = 16;
/** Every Nth step gets a taller "beat" mark instead of a plain tick — purely decorative, the primitive itself has no opinion on marks. */
const DEFAULT_STEPS_PER_BEAT = 4;

interface RulerProps extends RulerPrimitive.RootProps {
  /** Shows the playhead part. Position updates far too fast for React state — drive it via `playheadRef`. */
  isPlaying?: boolean;
  playheadRef?: React.RefObject<HTMLDivElement | null>;
  stepsPerBeat?: number;
}

export function Ruler({
  className,
  isPlaying,
  playheadRef,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
  totalSteps = DEFAULT_TOTAL_STEPS,
  ...props
}: RulerProps) {
  return (
    <RulerPrimitive.Root
      className="w-full min-w-0"
      totalSteps={totalSteps}
      {...props}
    >
      <RulerPrimitive.Track
        className={cn(
          "cn-ruler relative w-full min-w-0 touch-none select-none overflow-hidden",
          "focus-visible:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
          className
        )}
        data-slot="ruler"
      >
        {Array.from({ length: totalSteps }, (_, step) => (
          <div
            className={cn(
              "cn-ruler-mark absolute inset-y-0 w-px",
              step % stepsPerBeat === 0 && "cn-ruler-mark-beat"
            )}
            key={String(step)}
            style={{ left: `${(step / totalSteps) * 100}%` }}
          />
        ))}
        <RulerPrimitive.LoopRegion className="cn-ruler-region inset-y-0 cursor-grab touch-none select-none outline-none active:cursor-grabbing">
          <RulerPrimitive.LoopRegionHandle
            className="cn-ruler-region-handle inset-y-0 left-0 w-2 cursor-ew-resize"
            side="start"
          />
          <RulerPrimitive.LoopRegionHandle
            className="cn-ruler-region-handle inset-y-0 right-0 w-2 cursor-ew-resize"
            side="end"
          />
        </RulerPrimitive.LoopRegion>
        {isPlaying ? (
          <RulerPrimitive.Playhead
            className="cn-ruler-playhead inset-y-0 w-px"
            ref={playheadRef}
          />
        ) : null}
      </RulerPrimitive.Track>
    </RulerPrimitive.Root>
  );
}
