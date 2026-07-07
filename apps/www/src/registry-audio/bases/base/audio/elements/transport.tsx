"use client";

import { Transport as TransportPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const transportSliderVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "",
      lg: "",
      sm: "",
    },
  },
});

const transportTrackVariants = cva(
  "cn-transport-track relative grow cursor-pointer select-none overflow-hidden",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-transport-track-size-default",
        lg: "cn-transport-track-size-lg",
        sm: "cn-transport-track-size-sm",
      },
    },
  }
);

const transportThumbVariants = cva(
  "cn-transport-thumb before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-transport-thumb-size-default",
        lg: "cn-transport-thumb-size-lg",
        sm: "cn-transport-thumb-size-sm",
      },
    },
  }
);

const transportThumbInnerVariants = cva(
  "flex h-full w-full items-center justify-center data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-transport-thumb-inner-size-default",
        lg: "cn-transport-thumb-inner-size-lg",
        sm: "cn-transport-thumb-inner-size-sm",
      },
    },
  }
);

const transportThumbMarkVariants = cva("cn-transport-thumb-mark", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-transport-thumb-mark-size-default",
      lg: "cn-transport-thumb-mark-size-lg",
      sm: "cn-transport-thumb-mark-size-sm",
    },
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
        <TransportPrimitive.Track
          className={transportTrackVariants({ size })}
          data-slot="transport-track"
        >
          <TransportPrimitive.BufferedRange
            className={cn(
              "cn-transport-buffered-range absolute z-0 select-none",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0"
            )}
          />
          <TransportPrimitive.Range
            className={cn(
              "cn-transport-range absolute select-none",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0"
            )}
          />
        </TransportPrimitive.Track>
        <TransportPrimitive.Thumb
          className={transportThumbVariants({ size })}
          data-slot="transport-thumb"
        >
          <TransportPrimitive.ThumbInner
            className={transportThumbInnerVariants({ size })}
            data-slot="transport-thumb-inner"
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
