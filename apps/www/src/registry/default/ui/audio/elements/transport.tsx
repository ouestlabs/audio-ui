"use client";

import { Transport as TransportPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "@/registry/default/lib/utils";

const transportSliderVariants = cva("", {
  variants: {
    size: {
      sm: "",
      default: "",
      lg: "",
    },
  },
  compoundVariants: [
    { size: "sm", class: "data-[orientation=horizontal]:h-4" },
    { size: "default", class: "data-[orientation=horizontal]:h-5" },
    { size: "lg", class: "data-[orientation=horizontal]:h-6" },
  ],
  defaultVariants: {
    size: "default",
  },
});

const transportTrackVariants = cva(
  "relative grow cursor-pointer overflow-hidden rounded-full bg-muted",
  {
    variants: {
      size: {
        sm: "",
        default: "",
        lg: "",
      },
    },
    compoundVariants: [
      {
        size: "sm",
        class:
          "data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5",
      },
      {
        size: "default",
        class:
          "data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2",
      },
      {
        size: "lg",
        class:
          "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2.5",
      },
    ],
    defaultVariants: {
      size: "default",
    },
  }
);

const transportThumbVariants = cva(
  "before:-inset-2 absolute z-10 block shrink-0 cursor-grab rounded-md border border-border bg-card shadow-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out before:absolute before:content-[''] hover:ring-2 hover:ring-ring/50 focus-visible:border-ring focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing active:border-ring active:ring-2 active:ring-ring data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed motion-reduce:transition-none",
  {
    variants: {
      size: {
        sm: "",
        default: "",
        lg: "",
      },
    },
    compoundVariants: [
      {
        size: "sm",
        class:
          "data-[orientation=horizontal]:h-5 data-[orientation=vertical]:h-3 data-[orientation=horizontal]:w-3 data-[orientation=vertical]:w-5",
      },
      {
        size: "default",
        class:
          "data-[orientation=horizontal]:h-6 data-[orientation=vertical]:h-3.5 data-[orientation=horizontal]:w-3.5 data-[orientation=vertical]:w-6",
      },
      {
        size: "lg",
        class:
          "data-[orientation=horizontal]:h-7 data-[orientation=vertical]:h-4 data-[orientation=horizontal]:w-4 data-[orientation=vertical]:w-7",
      },
    ],
    defaultVariants: {
      size: "default",
    },
  }
);

const transportThumbMarkVariants = cva("bg-muted-foreground opacity-30", {
  variants: {
    size: {
      sm: "",
      default: "",
      lg: "",
    },
  },
  compoundVariants: [
    {
      size: "sm",
      class:
        "data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-2",
    },
    {
      size: "default",
      class:
        "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-2.5",
    },
    {
      size: "lg",
      class:
        "data-[orientation=horizontal]:h-3 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-3",
    },
  ],
  defaultVariants: {
    size: "default",
  },
});

type TransportProps = Omit<
  React.ComponentProps<typeof TransportPrimitive.Root>,
  "value" | "onValueChange" | "bufferedValue"
> & {
  value: number;
  bufferedValue?: number;
  onSeek: (nextValue: number) => void;
} & VariantProps<typeof transportSliderVariants>;

function Transport({
  value,
  bufferedValue,
  onSeek,
  size,
  min = 0,
  max = 100,
  className,
  orientation,
  ...props
}: TransportProps) {
  return (
    <TransportPrimitive.Root
      bufferedValue={bufferedValue}
      className={cn("relative w-full", className)}
      max={max}
      min={min}
      onValueChange={onSeek}
      orientation={orientation}
      value={value}
      {...props}
    >
      <TransportPrimitive.Slider
        className={cn(
          "relative flex touch-none select-none items-center data-disabled:opacity-50",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-32 data-[orientation=vertical]:w-full data-[orientation=vertical]:flex-col",
          "data-[orientation=horizontal]:w-full",
          transportSliderVariants({ size })
        )}
      >
        <TransportPrimitive.Track className={transportTrackVariants({ size })}>
          <TransportPrimitive.BufferedRange
            className={cn(
              "absolute z-0 bg-primary/40",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0"
            )}
          />
          <TransportPrimitive.Range
            className={cn(
              "absolute bg-primary",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0"
            )}
          />
        </TransportPrimitive.Track>
        <TransportPrimitive.Thumb className={transportThumbVariants({ size })}>
          <TransportPrimitive.ThumbInner
            className={cn(
              "flex h-full w-full items-center justify-center",
              "data-[orientation=horizontal]:flex-row",
              "data-[orientation=vertical]:flex-col"
            )}
          >
            <TransportPrimitive.ThumbMark
              className={transportThumbMarkVariants({ size })}
            />
          </TransportPrimitive.ThumbInner>
        </TransportPrimitive.Thumb>
      </TransportPrimitive.Slider>
    </TransportPrimitive.Root>
  );
}

export { Transport };
