import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/registry/lib/utils";
import { Piano as PianoPrimitive } from "@/registry/primitives/piano/react";

/**
 * How each part of the keyboard is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the keyboard's props: the React piano applies
 * these classes, and `registry:build` writes them as plain CSS on the parts
 * for every other framework. The root carries `data-size`; a key, its
 * `data-color` and `data-active`.
 */
export const pianoParts = Object.freeze({
  piano:
    "cn-piano w-full touch-none select-none overflow-hidden data-disabled:pointer-events-none data-disabled:opacity-50",
  "piano-key": "cn-piano-key cursor-pointer",
});

/** The parts whose look changes with the keyboard's `data-size`, by size. */
export const pianoSizes = Object.freeze({
  piano: Object.freeze({
    default: "cn-piano-size-default",
    lg: "cn-piano-size-lg",
    sm: "cn-piano-size-sm",
  }),
});

const pianoVariants = cva(pianoParts.piano, {
  defaultVariants: { size: "default" },
  variants: { size: pianoSizes.piano },
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
      className={cn(pianoVariants({ size }), className)}
      data-size={size ?? "default"}
      data-slot="piano"
      {...props}
    >
      {({ pitches }) =>
        pitches.map((pitch) => (
          <PianoPrimitive.Key
            className={pianoParts["piano-key"]}
            key={pitch}
            pitch={pitch}
          />
        ))
      }
    </PianoPrimitive.Root>
  );
}
