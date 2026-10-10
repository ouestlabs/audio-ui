"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

const knobVariants = cva(
  "cn-knob relative inline-flex outline-none data-disabled:cursor-not-allowed",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-knob-size-default",
        lg: "cn-knob-size-lg",
        sm: "cn-knob-size-sm",
        xl: "cn-knob-size-xl",
      },
    },
  }
);

const knobControlClassName =
  "cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-disabled:pointer-events-none data-disabled:opacity-50";

const knobBodyVariants = cva("cn-knob-body absolute z-0", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-knob-body-size-default",
      lg: "cn-knob-body-size-lg",
      sm: "cn-knob-body-size-sm",
      xl: "cn-knob-body-size-xl",
    },
  },
});

export type KnobProps = KnobPrimitive.Root.Props &
  VariantProps<typeof knobVariants>;

function Knob({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  size,
  ...props
}: KnobProps) {
  return (
    <KnobPrimitive.Root
      className={cn(knobVariants({ size }), className)}
      data-slot="knob"
      {...props}
    >
      <KnobPrimitive.Control
        className={knobControlClassName}
        data-slot="knob-control"
      >
        <div className={knobBodyVariants({ size })} data-slot="knob-body" />
        <KnobPrimitive.Track
          className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22"
          data-slot="knob-track"
        />
        <KnobPrimitive.Indicator
          className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full"
          data-slot="knob-arc"
        />
        <KnobPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="pointer-events-none absolute inset-0 z-2"
          data-slot="knob-thumb"
        >
          <svg
            aria-hidden="true"
            className="cn-knob-indicator block size-full"
            viewBox="0 0 48 48"
          >
            <line
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={2.75}
              x1={24}
              x2={24}
              y1={11.53}
              y2={18.84}
            />
          </svg>
        </KnobPrimitive.Thumb>
      </KnobPrimitive.Control>
    </KnobPrimitive.Root>
  );
}

export { Knob, knobVariants };
