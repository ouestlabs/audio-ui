"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

const knobVariants = cva("cn-knob relative inline-flex outline-none", {
  variants: {
    size: {
      sm: "cn-knob-size-sm",
      default: "cn-knob-size-default",
      lg: "cn-knob-size-lg",
      xl: "cn-knob-size-xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const knobControlClassName =
  "cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50";

const knobBodyVariants = cva("cn-knob-body absolute z-0", {
  variants: {
    size: {
      sm: "cn-knob-body-size-sm",
      default: "cn-knob-body-size-default",
      lg: "cn-knob-body-size-lg",
      xl: "cn-knob-body-size-xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export type KnobProps = KnobPrimitive.RootProps &
  VariantProps<typeof knobVariants>;

function Knob({ className, size, ...props }: KnobProps) {
  return (
    <KnobPrimitive.Root
      className={cn(knobVariants({ size }), className)}
      data-slot="knob"
      {...props}
    >
      <KnobPrimitive.Slider
        className={knobControlClassName}
        data-slot="knob-control"
      >
        <KnobPrimitive.Body
          className={knobBodyVariants({ size })}
          data-slot="knob-body"
        />
        <KnobPrimitive.Arc
          className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full"
          data-slot="knob-arc"
        />
        <KnobPrimitive.Indicator
          className="cn-knob-indicator pointer-events-none absolute inset-0 z-2 block size-full"
          data-slot="knob-indicator"
        />
      </KnobPrimitive.Slider>
    </KnobPrimitive.Root>
  );
}

export { Knob, knobVariants };
