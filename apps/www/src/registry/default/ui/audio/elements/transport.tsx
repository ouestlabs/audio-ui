"use client";

import { Transport as TransportPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "@/registry/default/lib/utils";

const transportSliderVariants = cva(
  "relative flex touch-none select-none items-center data-disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "",
        default: "",
        lg: "",
      },
      orientation: {
        horizontal: "w-full",
        vertical: "h-full w-full flex-col",
      },
    },
    compoundVariants: [
      { orientation: "horizontal", size: "sm", class: "h-4" },
      { orientation: "horizontal", size: "default", class: "h-5" },
      { orientation: "horizontal", size: "lg", class: "h-6" },
    ],
    defaultVariants: {
      size: "default",
      orientation: "horizontal",
    },
  }
);

const transportTrackVariants = cva(
  "relative grow cursor-pointer overflow-hidden rounded-full bg-muted",
  {
    variants: {
      size: {
        sm: "",
        default: "",
        lg: "",
      },
      orientation: {
        horizontal: "w-full",
        vertical: "h-full",
      },
    },
    compoundVariants: [
      { orientation: "horizontal", size: "sm", class: "h-1.5" },
      { orientation: "horizontal", size: "default", class: "h-2" },
      { orientation: "horizontal", size: "lg", class: "h-2.5" },
      { orientation: "vertical", size: "sm", class: "w-1.5" },
      { orientation: "vertical", size: "default", class: "w-2" },
      { orientation: "vertical", size: "lg", class: "w-2.5" },
    ],
    defaultVariants: {
      size: "default",
      orientation: "horizontal",
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
      orientation: {
        horizontal: "",
        vertical: "",
      },
    },
    compoundVariants: [
      { orientation: "horizontal", size: "sm", class: "h-5 w-3" },
      { orientation: "horizontal", size: "default", class: "h-6 w-3.5" },
      { orientation: "horizontal", size: "lg", class: "h-7 w-4" },
      { orientation: "vertical", size: "sm", class: "h-3 w-5" },
      { orientation: "vertical", size: "default", class: "h-3.5 w-6" },
      { orientation: "vertical", size: "lg", class: "h-4 w-7" },
    ],
    defaultVariants: {
      size: "default",
      orientation: "horizontal",
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
    orientation: {
      horizontal: "",
      vertical: "",
    },
  },
  compoundVariants: [
    { orientation: "horizontal", size: "sm", class: "h-2 w-px" },
    { orientation: "horizontal", size: "default", class: "h-2.5 w-px" },
    { orientation: "horizontal", size: "lg", class: "h-3 w-px" },
    { orientation: "vertical", size: "sm", class: "h-px w-2" },
    { orientation: "vertical", size: "default", class: "h-px w-2.5" },
    { orientation: "vertical", size: "lg", class: "h-px w-3" },
  ],
  defaultVariants: {
    size: "default",
    orientation: "horizontal",
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
  orientation = "horizontal",
  size,
  min = 0,
  max = 100,
  className,
  ...props
}: TransportProps) {
  return (
    <TransportPrimitive.Root
      bufferedValue={bufferedValue}
      className={cn(
        "relative",
        orientation === "vertical" ? "h-full w-full" : "w-full",
        className
      )}
      max={max}
      min={min}
      onValueChange={onSeek}
      orientation={orientation}
      value={value}
      {...props}
    >
      <TransportPrimitive.Slider
        className={transportSliderVariants({ size, orientation })}
      >
        <TransportPrimitive.Track
          className={transportTrackVariants({ size, orientation })}
        >
          <TransportPrimitive.BufferedRange
            className={
              orientation === "horizontal"
                ? "absolute inset-y-0 left-0 z-0 bg-primary/40"
                : "absolute inset-x-0 bottom-0 z-0 bg-primary/40"
            }
          />
          <TransportPrimitive.Range
            className={
              orientation === "horizontal"
                ? "absolute inset-y-0 left-0 bg-primary"
                : "absolute inset-x-0 bottom-0 bg-primary"
            }
          />
        </TransportPrimitive.Track>
        <TransportPrimitive.Thumb
          className={transportThumbVariants({ size, orientation })}
        >
          <TransportPrimitive.ThumbInner className="flex h-full w-full items-center justify-center">
            <TransportPrimitive.ThumbMark
              className={transportThumbMarkVariants({ size, orientation })}
            />
          </TransportPrimitive.ThumbInner>
        </TransportPrimitive.Thumb>
      </TransportPrimitive.Slider>
    </TransportPrimitive.Root>
  );
}

export { Transport };
