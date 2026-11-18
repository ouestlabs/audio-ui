import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Piano as PianoPrimitive } from "@/registry/bases/base/primitives/piano/react";

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
  extends Omit<
      ComponentProps<typeof PianoPrimitive.Root>,
      "children" | "className"
    >,
    VariantProps<typeof pianoVariants> {
  className?: string;
}

export function Piano({ className, size, ...props }: PianoProps) {
  return (
    <PianoPrimitive.Root
      className={cn(
        "cn-piano w-full touch-none select-none overflow-hidden",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        pianoVariants({ size }),
        className
      )}
      data-slot="piano"
      {...props}
    >
      {({ pitches }) =>
        pitches.map((pitch) => (
          <PianoPrimitive.Key
            className="cn-piano-key cursor-pointer"
            key={pitch}
            pitch={pitch}
          />
        ))
      }
    </PianoPrimitive.Root>
  );
}
