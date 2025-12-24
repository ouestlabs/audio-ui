"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/default/lib/utils";

const faderVariants = cva("", {
  variants: {
    size: {
      sm: "",
      default: "",
      lg: "",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

const faderTrackVariants = cva(
  "relative flex-1 cursor-pointer overflow-hidden rounded-full bg-muted",
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
      { orientation: "horizontal", size: "sm", class: "h-2 w-full" },
      { orientation: "horizontal", size: "default", class: "h-3 w-full" },
      { orientation: "horizontal", size: "lg", class: "h-4 w-full" },
      { orientation: "vertical", size: "sm", class: "h-full w-2" },
      { orientation: "vertical", size: "default", class: "h-full w-3" },
      { orientation: "vertical", size: "lg", class: "h-full w-4" },
    ],
    defaultVariants: {
      size: "default",
      orientation: "vertical",
    },
  }
);

const faderThumbVariants = cva(
  "absolute block shrink-0 cursor-grab rounded-md border border-border bg-card shadow-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out hover:ring-2 hover:ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing active:border-ring active:ring-2 active:ring-ring",
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
      { orientation: "horizontal", size: "sm", class: "h-7 w-4" },
      { orientation: "horizontal", size: "default", class: "h-9 w-5" },
      { orientation: "horizontal", size: "lg", class: "h-11 w-6" },
      { orientation: "vertical", size: "sm", class: "h-4 w-7" },
      { orientation: "vertical", size: "default", class: "h-5 w-9" },
      { orientation: "vertical", size: "lg", class: "h-6 w-11" },
    ],
    defaultVariants: {
      size: "default",
      orientation: "vertical",
    },
  }
);

const faderThumbMarkVariants = cva("bg-muted-foreground opacity-30", {
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
    { orientation: "horizontal", size: "sm", class: "h-3 w-px" },
    { orientation: "horizontal", size: "default", class: "h-4 w-px" },
    { orientation: "horizontal", size: "lg", class: "h-5 w-px" },
    { orientation: "vertical", size: "sm", class: "h-px w-3" },
    { orientation: "vertical", size: "default", class: "h-px w-4" },
    { orientation: "vertical", size: "lg", class: "h-px w-5" },
  ],
  defaultVariants: {
    size: "default",
    orientation: "vertical",
  },
});

interface FaderProps
  extends FaderPrimitive.RootProps,
    VariantProps<typeof faderVariants> {
  thumbMarks?: number | false;
}

export function Fader({
  className,
  size,
  orientation = "vertical",
  thumbMarks = 3,
  ...props
}: FaderProps) {
  return (
    <FaderPrimitive.Root
      className={cn("relative size-full", className)}
      orientation={orientation}
      {...props}
    >
      <FaderPrimitive.Slider
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          orientation === "vertical" && "h-full min-h-32 w-full flex-col",
          orientation === "horizontal" && "h-full min-w-32",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          faderVariants({ size })
        )}
      >
        <FaderPrimitive.Track
          className={faderTrackVariants({ size, orientation })}
        >
          <FaderPrimitive.Range
            className={cn(
              "absolute bg-primary",
              orientation === "horizontal" && "h-full",
              orientation === "vertical" && "bottom-0 w-full"
            )}
          />
        </FaderPrimitive.Track>

        <FaderPrimitive.Thumb
          className={cn(
            faderThumbVariants({ size, orientation }),
            "data-[disabled=true]:cursor-not-allowed"
          )}
        >
          <FaderPrimitive.ThumbInner
            className={cn(
              "flex h-full w-full items-center justify-center gap-0.5",
              orientation === "horizontal" && "flex-row",
              orientation === "vertical" && "flex-col"
            )}
          >
            {thumbMarks !== false &&
              Array.from({ length: thumbMarks }, (_, i) => (
                <FaderPrimitive.ThumbMark
                  className={faderThumbMarkVariants({ size, orientation })}
                  key={String(i)}
                />
              ))}
          </FaderPrimitive.ThumbInner>
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Slider>
    </FaderPrimitive.Root>
  );
}
