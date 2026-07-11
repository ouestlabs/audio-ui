"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import { cn } from "@/lib/utils";

export function Fader({ className, ...props }: FaderPrimitive.RootProps) {
  return (
    <FaderPrimitive.Root
      className={cn(
        "relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full",
        className
      )}
      {...props}
    >
      <FaderPrimitive.Slider className="relative flex touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-36 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-36">
        <FaderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-zinc-200 shadow-inner data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2 dark:bg-zinc-800">
          <FaderPrimitive.Range className="absolute rounded-full bg-indigo-500 data-[orientation=horizontal]:h-full data-[orientation=vertical]:bottom-0 data-[orientation=vertical]:w-full" />
        </FaderPrimitive.Track>
        <FaderPrimitive.Thumb className="absolute z-10 flex size-5 shrink-0 cursor-grab items-center justify-center rounded-full border-2 border-indigo-500 bg-white shadow-md outline-none transition-shadow hover:shadow-lg hover:ring-4 hover:ring-indigo-500/20 focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:cursor-grabbing active:ring-4 active:ring-indigo-500/30 dark:bg-zinc-900">
          <FaderPrimitive.ThumbInner className="flex items-center justify-center gap-0.5 data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col">
            {Array.from({ length: 3 }, (_, i) => (
              <FaderPrimitive.ThumbMark
                className="bg-indigo-500 opacity-60 data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-2"
                key={String(i)}
              />
            ))}
          </FaderPrimitive.ThumbInner>
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Slider>
    </FaderPrimitive.Root>
  );
}
