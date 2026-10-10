"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
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
  "cn-transport-thumb before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none data-disabled:cursor-not-allowed",
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
  React.ComponentProps<typeof FaderPrimitive.Root>,
  "value" | "onValueChange"
> & {
  value: number;
  bufferedValue?: number;
  onSeek: (nextValue: number) => void;
} & VariantProps<typeof transportSliderVariants>;

function Transport({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  value,
  bufferedValue = 0,
  onSeek,
  size,
  min = 0,
  max = 100,
  className,
  orientation = "horizontal",
  ...props
}: TransportProps) {
  const bufferedPercentage = Math.min(
    Math.max((bufferedValue - min) / (max - min || 1), 0),
    1
  );

  return (
    <FaderPrimitive.Root
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
      <FaderPrimitive.Control
        className={cn(
          "relative flex w-full touch-none select-none items-center transition-opacity duration-150 ease-out motion-reduce:transition-none data-disabled:opacity-50",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
          "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32",
          transportSliderVariants({ size })
        )}
      >
        <FaderPrimitive.Track
          className={transportTrackVariants({ size })}
          data-slot="transport-track"
        >
          <div
            className={cn(
              "cn-transport-buffered-range absolute z-0 h-full w-full select-none will-change-transform",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0 data-[orientation=horizontal]:origin-left",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0 data-[orientation=vertical]:origin-bottom"
            )}
            data-orientation={orientation}
            style={{
              transform:
                orientation === "horizontal"
                  ? `scaleX(${bufferedPercentage})`
                  : `scaleY(${bufferedPercentage})`,
            }}
          />
          <FaderPrimitive.Indicator
            className={cn(
              "cn-transport-range absolute select-none",
              "data-[orientation=horizontal]:inset-y-0 data-[orientation=horizontal]:left-0",
              "data-[orientation=vertical]:inset-x-0 data-[orientation=vertical]:bottom-0"
            )}
          />
        </FaderPrimitive.Track>
        <FaderPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={transportThumbVariants({ size })}
          data-slot="transport-thumb"
        >
          <div
            className={transportThumbInnerVariants({ size })}
            data-orientation={orientation}
            data-slot="transport-thumb-inner"
          >
            <div
              className={transportThumbMarkVariants({ size })}
              data-orientation={orientation}
            />
          </div>
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Control>
    </FaderPrimitive.Root>
  );
}

export { Transport };
