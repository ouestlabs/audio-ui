"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const knobVariants = cva(
  "rounded-full border border-transparent shadow-md ring-1 ring-foreground/10 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/30 hover:ring-4 hover:ring-ring/30 has-[[data-slot=knob-control]:active]:border-ring has-[[data-slot=knob-control]:active]:ring-4 has-[[data-slot=knob-control]:active]:ring-ring motion-reduce:transition-none relative inline-flex outline-none",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "size-12",
        lg: "size-16",
        sm: "size-11",
        xl: "size-24",
      },
    },
  }
);

const knobControlClassName =
  "bg-secondary text-secondary-foreground shadow-xs transition-[color,background-color,box-shadow,border-color,opacity] duration-150 ease-out hover:bg-secondary/90 active:shadow-[inset_0_-14px_28px_-12px_rgb(0_0_0/0.14)] motion-reduce:transition-none dark:bg-secondary/60 dark:hover:bg-secondary/70 dark:active:shadow-[inset_0_-14px_28px_-12px_rgb(0_0_0/0.28)] transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50";

const knobBodyVariants = cva(
  "rounded-full bg-card text-card-foreground shadow-md ring-1 ring-foreground/10 transition-transform duration-100 ease-out motion-reduce:transition-none absolute z-0",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "inset-1.5",
        lg: "inset-2",
        sm: "inset-1",
        xl: "inset-2.5",
      },
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
          className="text-primary [&_path]:stroke-current pointer-events-none absolute inset-0 z-1 block size-full"
          data-slot="knob-arc"
        />
        <KnobPrimitive.Indicator
          className="text-primary pointer-events-none absolute inset-0 z-2 block size-full"
          data-slot="knob-indicator"
        />
      </KnobPrimitive.Slider>
    </KnobPrimitive.Root>
  );
}

export { Knob, knobVariants };
