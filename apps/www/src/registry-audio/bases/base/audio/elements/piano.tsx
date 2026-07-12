"use client";

import { Piano as PianoPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

const pianoVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-piano-size-default",
      lg: "cn-piano-size-lg",
      sm: "cn-piano-size-sm",
    },
  },
});

interface PianoProps
  extends PianoPrimitive.RootProps,
    VariantProps<typeof pianoVariants> {}

export function Piano({ className, size, ...props }: PianoProps) {
  return (
    <PianoPrimitive.Root
      className="w-full data-[disabled=true]:cursor-not-allowed"
      {...props}
    >
      <PianoPrimitive.Track
        className={cn(
          "cn-piano w-full touch-none select-none overflow-hidden",
          "focus-visible:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
          pianoVariants({ size }),
          className
        )}
        data-slot="piano"
      >
        <PianoPrimitive.Keys>
          {(note, _color, index) => (
            <PianoPrimitive.Key
              className="cn-piano-key cursor-pointer outline-none"
              index={index}
              key={note}
            />
          )}
        </PianoPrimitive.Keys>
      </PianoPrimitive.Track>
    </PianoPrimitive.Root>
  );
}
