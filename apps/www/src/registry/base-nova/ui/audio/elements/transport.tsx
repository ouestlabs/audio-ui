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
  defaultVariants: {
    size: "default",
  },
});

// nova: thinner track, bg-muted (not bg-input/90)
const transportTrackVariants = cva(
  "relative grow cursor-pointer select-none overflow-hidden rounded-full bg-muted",
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
          "data-[orientation=horizontal]:h-1 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1",
      },
      {
        size: "default",
        class:
          "data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5",
      },
      {
        size: "lg",
        class:
          "data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2",
      },
    ],
    defaultVariants: {
      size: "default",
    },
  }
);

// nova: rounded-lg thumb (not rounded-full), ring-ring/50 (not ring-ring/30), shadow-sm
const transportThumbVariants = cva(
  "before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none rounded-lg bg-white not-dark:bg-clip-padding shadow-sm ring-1 ring-black/10 transition-[color,box-shadow,background-color] before:absolute before:content-[''] hover:ring-3 hover:ring-ring/50 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed motion-reduce:transition-none dark:bg-card dark:ring-foreground/10",
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
          "data-[orientation=horizontal]:h-3 data-[orientation=vertical]:h-4.5 data-[orientation=horizontal]:w-4.5 data-[orientation=vertical]:w-3",
      },
      {
        size: "default",
        class:
          "data-[orientation=horizontal]:h-3.5 data-[orientation=vertical]:h-5.5 data-[orientation=horizontal]:w-5.5 data-[orientation=vertical]:w-3.5",
      },
      {
        size: "lg",
        class:
          "data-[orientation=horizontal]:h-4 data-[orientation=vertical]:h-6.5 data-[orientation=horizontal]:w-6.5 data-[orientation=vertical]:w-4",
      },
    ],
    defaultVariants: {
      size: "default",
    },
  }
);

const transportThumbMarkVariants = cva("bg-primary opacity-40", {
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
      className={cn(
        "relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full",
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
        className={cn(
          "relative flex w-full touch-none select-none items-center data-disabled:opacity-50",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
          "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32",
          transportSliderVariants({ size })
        )}
      >
        <TransportPrimitive.Track className={transportTrackVariants({ size })}>
          <TransportPrimitive.BufferedRange
            className={cn(
              "absolute z-0 select-none bg-primary/30",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0"
            )}
          />
          <TransportPrimitive.Range
            className={cn(
              "absolute select-none bg-primary",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0"
            )}
          />
        </TransportPrimitive.Track>
        <TransportPrimitive.Thumb className={transportThumbVariants({ size })}>
          <TransportPrimitive.ThumbInner
            className={cn(
              "flex h-full w-full items-center justify-center",
              "data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:px-1.5 data-[orientation=horizontal]:py-1",
              "data-[orientation=vertical]:flex-col data-[orientation=vertical]:px-1 data-[orientation=vertical]:py-1.5",
              size === "sm" &&
                "data-[orientation=horizontal]:px-1 data-[orientation=vertical]:px-0.5 data-[orientation=horizontal]:py-0.5 data-[orientation=vertical]:py-1",
              size === "lg" &&
                "data-[orientation=horizontal]:px-2 data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:py-2"
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
