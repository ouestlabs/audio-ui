"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/default/lib/utils";

const knobVariants = cva("", {
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
});

const knobBodyVariants = cva(
  "absolute rounded-full border border-border bg-card shadow-sm transition-transform duration-100 ease-out",
  {
    variants: {
      size: {
        sm: "inset-0.5",
        default: "inset-1",
        lg: "inset-1.5",
        xl: "inset-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const knobIndicatorVariants = cva(
  "-translate-x-1/2 absolute left-1/2 rounded-full bg-primary",
  {
    variants: {
      size: {
        sm: "top-0.5 h-2 w-0.5",
        default: "top-1 h-3 w-0.5",
        lg: "top-1.5 h-4 w-0.5",
        xl: "top-2 h-6 w-1",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface KnobProps
  extends KnobPrimitive.RootProps,
    VariantProps<typeof knobVariants> {}

function Knob({ className, size, ...props }: KnobProps) {
  return (
    <KnobPrimitive.Root
      className={cn("relative inline-flex", className)}
      {...props}
    >
      <KnobPrimitive.Slider
        className={cn(
          "relative flex cursor-grab touch-none select-none",
          "rounded-full border border-transparent bg-muted shadow-inner",
          "transition-[color,border-color,box-shadow] duration-150 ease-out",
          "hover:shadow-inner hover:ring-2 hover:ring-ring/50",
          "focus-visible:border-ring focus-visible:shadow-inner focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "active:cursor-grabbing active:border-ring active:shadow-inner active:ring-2 active:ring-ring",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          knobVariants({ size })
        )}
      >
        <KnobPrimitive.Arc
          className={cn(
            "pointer-events-none absolute inset-0 size-full overflow-visible",
            "[&_path]:fill-primary [&_path]:opacity-60"
          )}
        />
        <KnobPrimitive.Body className={knobBodyVariants({ size })}>
          <KnobPrimitive.Indicator
            className={knobIndicatorVariants({ size })}
          />
        </KnobPrimitive.Body>
      </KnobPrimitive.Slider>
    </KnobPrimitive.Root>
  );
}

export { type KnobProps, Knob };
