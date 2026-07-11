"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cn } from "@/lib/utils";

export function Knob({ className, ...props }: KnobPrimitive.RootProps) {
  return (
    <KnobPrimitive.Root
      className={cn(
        "relative inline-flex size-14 rounded-full outline-none",
        className
      )}
      {...props}
    >
      <KnobPrimitive.Slider className="relative flex size-full cursor-grab touch-none select-none items-center justify-center outline-none active:cursor-grabbing">
        <KnobPrimitive.Arc className="pointer-events-none absolute inset-0 z-0 block size-full text-indigo-500 [&_path]:stroke-current" />
        <KnobPrimitive.Body className="absolute inset-2 z-10 rounded-full bg-white shadow-md ring-1 ring-black/5 dark:bg-zinc-900" />
        <KnobPrimitive.Indicator className="pointer-events-none absolute inset-0 z-20 block size-full text-indigo-500" />
      </KnobPrimitive.Slider>
    </KnobPrimitive.Root>
  );
}
