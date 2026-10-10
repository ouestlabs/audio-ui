"use client";

import { Envelope as EnvelopePrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { CSSProperties } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const envelopeVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-envelope-size-default",
      lg: "cn-envelope-size-lg",
      sm: "cn-envelope-size-sm",
    },
  },
});

/** The frame's room for the end points, which the grid's lines are measured from. */
const INSET = "0.875rem";

/** A line every quarter across and down, spread over the whole frame like a plot's: they sit on the data's own coordinates, so a point is on a line at 0, ¼, ½, ¾ and 1. */
const GRID: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
  backgroundPosition: `${INSET} 0, 0 ${INSET}`,
  backgroundSize: `calc((100% - 2 * ${INSET}) / 4) 100%, 100% calc((100% - 2 * ${INSET}) / 4)`,
};

interface EnvelopeProps
  extends EnvelopePrimitive.Root.Props,
    VariantProps<typeof envelopeVariants> {}

/**
 * The frame has room inside it, so the first and last points sit within it
 * instead of on its edge.
 */
export function Envelope({ className, size, ...props }: EnvelopeProps) {
  return (
    <div
      className={cn(
        "cn-envelope group/envelope box-border w-full touch-none select-none p-3.5",
        "has-data-disabled:pointer-events-none has-data-disabled:opacity-50",
        envelopeVariants({ size }),
        className
      )}
      data-slot="envelope"
      style={GRID}
    >
      <EnvelopePrimitive.Root
        className="size-full data-disabled:cursor-not-allowed"
        role="group"
        {...props}
      >
        <EnvelopePrimitive.Graph className="size-full overflow-visible">
          <EnvelopePrimitive.Fill className="cn-envelope-fill" />
          <EnvelopePrimitive.Line className="cn-envelope-path" />
        </EnvelopePrimitive.Graph>
        <EnvelopePrimitive.Points>
          {(_point, index, points) => (
            <EnvelopePrimitive.Point
              aria-label={`Point ${index + 1} of ${points.length}`}
              className="cn-envelope-point size-4 cursor-grab touch-none select-none outline-none active:cursor-grabbing"
              index={index}
              key={index}
            />
          )}
        </EnvelopePrimitive.Points>
      </EnvelopePrimitive.Root>
    </div>
  );
}
