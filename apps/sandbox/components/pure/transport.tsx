"use client";

import { Transport as TransportPrimitive } from "@audio-ui/react";
import type React from "react";
import { cn } from "@/lib/utils";

type TransportProps = Omit<
  React.ComponentProps<typeof TransportPrimitive.Root>,
  "value" | "onValueChange" | "bufferedValue"
> & {
  value: number;
  bufferedValue?: number;
  onSeek: (nextValue: number) => void;
};

export function Transport({
  value,
  bufferedValue,
  onSeek,
  min = 0,
  max = 100,
  className,
  ...props
}: TransportProps) {
  return (
    <TransportPrimitive.Root
      bufferedValue={bufferedValue}
      className={cn("relative w-full", className)}
      max={max}
      min={min}
      onValueChange={onSeek}
      value={value}
      {...props}
    >
      <TransportPrimitive.Slider className="relative flex w-full min-w-32 touch-none select-none items-center">
        <TransportPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200 shadow-inner dark:bg-zinc-800">
          <TransportPrimitive.BufferedRange className="absolute inset-y-0 left-0 rounded-full bg-zinc-400 dark:bg-zinc-600" />
          <TransportPrimitive.Range className="absolute inset-y-0 left-0 rounded-full bg-indigo-500" />
        </TransportPrimitive.Track>
        <TransportPrimitive.Thumb className="absolute z-10 flex size-5 shrink-0 cursor-grab items-center justify-center rounded-full border-2 border-indigo-500 bg-white shadow-md outline-none transition-shadow hover:shadow-lg hover:ring-4 hover:ring-indigo-500/20 focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:cursor-grabbing active:ring-4 active:ring-indigo-500/30 dark:bg-zinc-900">
          <TransportPrimitive.ThumbInner className="flex items-center justify-center">
            <TransportPrimitive.ThumbMark className="h-2.5 w-px bg-indigo-500 opacity-60" />
          </TransportPrimitive.ThumbInner>
        </TransportPrimitive.Thumb>
      </TransportPrimitive.Slider>
    </TransportPrimitive.Root>
  );
}
