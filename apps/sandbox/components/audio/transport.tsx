"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type React from "react";
import { cn } from "@/lib/utils";

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
  "rounded-full bg-input/90 relative grow cursor-pointer select-none overflow-hidden",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default:
          "data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2",
        lg: "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2.5",
        sm: "data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5",
      },
    },
  }
);

const transportThumbVariants = cva(
  "border-ring border bg-card transition-[color,box-shadow] hover:ring-3 hover:ring-ring/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 motion-reduce:transition-none before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none data-disabled:cursor-not-allowed",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default:
          "rounded-[min(var(--radius-md),10px)] data-[orientation=horizontal]:h-4 data-[orientation=vertical]:h-6 data-[orientation=horizontal]:w-6 data-[orientation=vertical]:w-4",
        lg: "rounded-[min(var(--radius-lg),12px)] data-[orientation=horizontal]:h-5 data-[orientation=vertical]:h-7 data-[orientation=horizontal]:w-7 data-[orientation=vertical]:w-5",
        sm: "rounded-[min(var(--radius-sm),8px)] data-[orientation=horizontal]:h-3.5 data-[orientation=vertical]:h-5 data-[orientation=horizontal]:w-5 data-[orientation=vertical]:w-3.5",
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
        default:
          "data-[orientation=horizontal]:px-1.5 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:px-1 data-[orientation=vertical]:py-1.5",
        lg: "data-[orientation=horizontal]:px-2 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:px-1 data-[orientation=vertical]:py-2",
        sm: "data-[orientation=horizontal]:px-1 data-[orientation=horizontal]:py-0.5 data-[orientation=vertical]:px-0.5 data-[orientation=vertical]:py-1",
      },
    },
  }
);

const transportThumbMarkVariants = cva("bg-primary opacity-50", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default:
        "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-2.5",
      lg: "data-[orientation=horizontal]:h-3 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-3",
      sm: "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-2.5",
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
              "bg-primary/40 absolute z-0 h-full w-full select-none will-change-transform",
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
              "bg-primary absolute select-none",
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
