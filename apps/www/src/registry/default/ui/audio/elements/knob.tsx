"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/default/lib/utils";

const knobVariants = cva(
  "relative inline-flex rounded-full border border-transparent outline-none transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:ring-2 hover:ring-ring/50 has-[[data-slot=knob-control]:active]:border-ring has-[[data-slot=knob-control]:active]:ring-2 has-[[data-slot=knob-control]:active]:ring-ring",
  {
    variants: {
      size: {
        sm: "size-8",
        default: "size-12",
        lg: "size-16",
        xl: "size-24",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const knobControlClassName =
  "transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none bg-secondary text-secondary-foreground shadow-xs outline-none transition-[color,background-color,box-shadow,border-color] duration-150 ease-out hover:bg-secondary/90 [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing active:shadow-[inset_0_-14px_28px_-12px_rgb(0_0_0/0.14)] data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 dark:bg-secondary/60 dark:hover:bg-secondary/70 dark:active:shadow-[inset_0_-14px_28px_-12px_rgb(0_0_0/0.28)]";

const knobBodyVariants = cva(
  "absolute z-0 rounded-full border border-border bg-card text-card-foreground shadow-xs transition-transform duration-100 ease-out",
  {
    variants: {
      size: {
        sm: "inset-1",
        default: "inset-1.5",
        lg: "inset-2",
        xl: "inset-2.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

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
          className="pointer-events-none absolute inset-0 z-1 block size-full text-primary [&_path]:stroke-current"
          data-slot="knob-arc"
        />
        <KnobPrimitive.Indicator
          className="pointer-events-none absolute inset-0 z-2 block size-full text-primary"
          data-slot="knob-indicator"
        />
      </KnobPrimitive.Slider>
    </KnobPrimitive.Root>
  );
}

export { Knob, knobVariants };
