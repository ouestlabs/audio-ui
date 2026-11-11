"use client";

import { Piano as PianoPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const pianoVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "h-32",
      lg: "h-40",
      sm: "h-24",
    },
  },
});

interface PianoProps
  extends Omit<PianoPrimitive.Root.Props, "className">,
    VariantProps<typeof pianoVariants> {
  className?: string;
}

export function Piano({ className, size, ...props }: PianoProps) {
  return (
    <PianoPrimitive.Root
      className={cn(
        "rounded-xl border border-transparent bg-card ring-1 ring-foreground/10 transition-[color,border-color,box-shadow,opacity] duration-150 ease-out hover:ring-3 hover:ring-ring/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 has-focus-visible:border-ring active:border-ring motion-reduce:transition-none [--piano-key-white:oklch(0.985_0_0)] [--piano-key-black:oklch(0.205_0_0)] w-full touch-none select-none overflow-hidden",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        pianoVariants({ size }),
        className
      )}
      data-slot="piano"
      {...props}
    >
      <PianoPrimitive.Keys>
        {(pitch) => (
          <PianoPrimitive.Key
            className="top-0 outline-none transition-colors duration-100 ease-out focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset data-[color=white]:z-0 data-[color=white]:h-full data-[color=white]:border-[color:color-mix(in_oklab,var(--piano-key-black)_30%,transparent)] data-[color=white]:border-x data-[color=white]:bg-(--piano-key-white) data-[color=black]:z-10 data-[color=black]:h-[60%] data-[color=black]:rounded-b-[min(var(--radius-sm),4px)] data-[color=black]:bg-(--piano-key-black) data-[active]:data-[color]:bg-primary motion-reduce:transition-none cursor-pointer"
            key={pitch}
            pitch={pitch}
          />
        )}
      </PianoPrimitive.Keys>
    </PianoPrimitive.Root>
  );
}
