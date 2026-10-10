"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cn } from "@/lib/utils";

export function Knob({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  ...props
}: KnobPrimitive.Root.Props) {
  return (
    <KnobPrimitive.Root
      className={cn(
        "relative inline-flex size-14 rounded-full outline-none",
        className
      )}
      {...props}
    >
      <KnobPrimitive.Control className="relative flex size-full cursor-grab touch-none select-none items-center justify-center outline-none active:cursor-grabbing">
        <KnobPrimitive.Track className="pointer-events-none absolute inset-0 z-0 block size-full text-indigo-500 opacity-22" />
        <KnobPrimitive.Indicator className="pointer-events-none absolute inset-0 z-0 block size-full text-indigo-500" />
        <div className="absolute inset-2 z-10 rounded-full bg-white shadow-md ring-1 ring-black/5 dark:bg-zinc-900" />
        <KnobPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="pointer-events-none absolute inset-0 z-20"
        >
          <svg
            aria-hidden="true"
            className="block size-full text-indigo-500"
            viewBox="0 0 48 48"
          >
            <line
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={2.75}
              x1={24}
              x2={24}
              y1={11.53}
              y2={18.84}
            />
          </svg>
        </KnobPrimitive.Thumb>
      </KnobPrimitive.Control>
    </KnobPrimitive.Root>
  );
}
