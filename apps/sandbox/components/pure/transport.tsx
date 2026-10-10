"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import type React from "react";
import { cn } from "@/lib/utils";

type TransportProps = Omit<
  React.ComponentProps<typeof FaderPrimitive.Root>,
  "value" | "onValueChange"
> & {
  value: number;
  bufferedValue?: number;
  onSeek: (nextValue: number) => void;
};

export function Transport({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  value,
  bufferedValue = 0,
  onSeek,
  min = 0,
  max = 100,
  className,
  ...props
}: TransportProps) {
  const bufferedPercentage = Math.min(
    Math.max((bufferedValue - min) / (max - min || 1), 0),
    1
  );

  return (
    <FaderPrimitive.Root
      className={cn("relative w-full", className)}
      max={max}
      min={min}
      onValueChange={onSeek}
      orientation="horizontal"
      value={value}
      {...props}
    >
      <FaderPrimitive.Control className="relative flex w-full min-w-32 touch-none select-none items-center">
        <FaderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200 shadow-inner dark:bg-zinc-800">
          <div
            className="absolute inset-y-0 left-0 h-full w-full origin-left will-change-transform rounded-full bg-zinc-400 dark:bg-zinc-600"
            style={{ transform: `scaleX(${bufferedPercentage})` }}
          />
          <FaderPrimitive.Indicator className="absolute inset-y-0 left-0 rounded-full bg-indigo-500" />
        </FaderPrimitive.Track>
        <FaderPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="absolute z-10 flex size-5 shrink-0 cursor-grab items-center justify-center rounded-full border-2 border-indigo-500 bg-white shadow-md outline-none transition-shadow hover:shadow-lg hover:ring-4 hover:ring-indigo-500/20 has-focus-visible:ring-4 has-focus-visible:ring-indigo-500/30 active:cursor-grabbing active:ring-4 active:ring-indigo-500/30 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-center">
            <div className="h-2.5 w-px bg-indigo-500 opacity-60" />
          </div>
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Control>
    </FaderPrimitive.Root>
  );
}
