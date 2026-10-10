"use client";

import { Envelope as EnvelopePrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
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

interface EnvelopeProps
  extends EnvelopePrimitive.Root.Props,
    VariantProps<typeof envelopeVariants> {}

export function Envelope({ className, size, ...props }: EnvelopeProps) {
  return (
    <EnvelopePrimitive.Root
      className="w-full data-disabled:cursor-not-allowed"
      role="group"
      {...props}
    >
      <EnvelopePrimitive.Graph
        className={cn(
          "cn-envelope w-full touch-none select-none overflow-hidden",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          envelopeVariants({ size }),
          className
        )}
        data-slot="envelope"
      >
        <EnvelopePrimitive.Fill className="cn-envelope-fill" />
        <EnvelopePrimitive.Line className="cn-envelope-path" />
      </EnvelopePrimitive.Graph>
      <EnvelopePrimitive.Points>
        {(_point, index, points) => (
          <EnvelopePrimitive.Point
            aria-label={`Point ${index + 1} of ${points.length}`}
            className="cn-envelope-point cursor-grab touch-none select-none outline-none active:cursor-grabbing"
            index={index}
            key={index}
          />
        )}
      </EnvelopePrimitive.Points>
    </EnvelopePrimitive.Root>
  );
}
