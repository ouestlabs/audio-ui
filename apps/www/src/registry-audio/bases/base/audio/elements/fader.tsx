"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

const faderVariants = cva("", {
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

const faderTrackVariants = cva(
  "cn-fader-track relative grow cursor-pointer select-none overflow-hidden",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-fader-track-size-default",
        lg: "cn-fader-track-size-lg",
        sm: "cn-fader-track-size-sm",
      },
    },
  }
);

const faderThumbVariants = cva(
  "cn-fader-thumb before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-fader-thumb-size-default",
        lg: "cn-fader-thumb-size-lg",
        sm: "cn-fader-thumb-size-sm",
      },
    },
  }
);

const faderThumbInnerVariants = cva(
  "flex h-full w-full items-center justify-center gap-0.5 data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-fader-thumb-inner-size-default",
        lg: "cn-fader-thumb-inner-size-lg",
        sm: "cn-fader-thumb-inner-size-sm",
      },
    },
  }
);

const faderThumbMarkVariants = cva("cn-fader-thumb-mark", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-fader-thumb-mark-size-default",
      lg: "cn-fader-thumb-mark-size-lg",
      sm: "cn-fader-thumb-mark-size-sm",
    },
  },
});

interface FaderProps
  extends FaderPrimitive.Root.Props,
    VariantProps<typeof faderVariants> {
  thumbMarks?: number | false;
}

export function Fader({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  size,
  orientation = "vertical",
  thumbMarks = 3,
  ...props
}: FaderProps) {
  return (
    <FaderPrimitive.Root
      className={cn(
        "relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-disabled:cursor-not-allowed",
        className
      )}
      orientation={orientation}
      {...props}
    >
      <FaderPrimitive.Control
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
          "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32",
          "transition-opacity duration-150 ease-out motion-reduce:transition-none data-disabled:pointer-events-none data-disabled:opacity-50",
          faderVariants({ size })
        )}
      >
        <FaderPrimitive.Track
          className={faderTrackVariants({ size })}
          data-slot="fader-track"
        >
          <FaderPrimitive.Indicator
            className={cn(
              "cn-fader-range absolute select-none",
              "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
              "data-[orientation=vertical]:bottom-0"
            )}
          />
        </FaderPrimitive.Track>

        <FaderPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={faderThumbVariants({ size })}
          data-slot="fader-thumb"
        >
          <div
            className={faderThumbInnerVariants({ size })}
            data-orientation={orientation}
            data-slot="fader-thumb-inner"
          >
            {thumbMarks !== false &&
              Array.from({ length: thumbMarks }, (_, i) => (
                <div
                  className={faderThumbMarkVariants({ size })}
                  data-orientation={orientation}
                  key={String(i)}
                />
              ))}
          </div>
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Control>
    </FaderPrimitive.Root>
  );
}
