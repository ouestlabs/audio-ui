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
  extends EnvelopePrimitive.RootProps,
    VariantProps<typeof envelopeVariants> {}

export function Envelope({ className, size, ...props }: EnvelopeProps) {
  return (
    <EnvelopePrimitive.Root className="w-full" {...props}>
      <EnvelopePrimitive.Svg
        className={cn(
          "cn-envelope w-full touch-none select-none overflow-hidden",
          "focus-visible:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          envelopeVariants({ size }),
          className
        )}
        data-slot="envelope"
      >
        <EnvelopePrimitive.Fill className="cn-envelope-fill" />
        <EnvelopePrimitive.Path className="cn-envelope-path" />
      </EnvelopePrimitive.Svg>
      <EnvelopePrimitive.Points>
        {(_point, index) => (
          <EnvelopePrimitive.Point
            className="cn-envelope-point cursor-grab touch-none select-none outline-none active:cursor-grabbing"
            index={index}
            key={index}
          />
        )}
      </EnvelopePrimitive.Points>
    </EnvelopePrimitive.Root>
  );
}
