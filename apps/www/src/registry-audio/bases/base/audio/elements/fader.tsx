"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

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
  "cn-fader-track relative grow cursor-pointer select-none overflow-hidden",
  {
    variants: {
      size: {
        sm: "cn-fader-track-size-sm",
        default: "cn-fader-track-size-default",
        lg: "cn-fader-track-size-lg",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const faderThumbVariants = cva(
  "cn-fader-thumb before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "cn-fader-thumb-size-sm",
        default: "cn-fader-thumb-size-default",
        lg: "cn-fader-thumb-size-lg",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const faderThumbInnerVariants = cva(
  "flex h-full w-full items-center justify-center gap-0.5 data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
  {
    variants: {
      size: {
        sm: "cn-fader-thumb-inner-size-sm",
        default: "cn-fader-thumb-inner-size-default",
        lg: "cn-fader-thumb-inner-size-lg",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const faderThumbMarkVariants = cva("cn-fader-thumb-mark", {
  variants: {
    size: {
      sm: "cn-fader-thumb-mark-size-sm",
      default: "cn-fader-thumb-mark-size-default",
      lg: "cn-fader-thumb-mark-size-lg",
    },
  },
  defaultVariants: {
    size: "default",
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
  orientation,
  thumbMarks = 3,
  ...props
}: FaderProps) {
  return (
    <FaderPrimitive.Root
      className={cn(
        "relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full",
        className
      )}
      orientation={orientation}
      {...props}
    >
      <FaderPrimitive.Slider
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
          "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          faderVariants({ size })
        )}
      >
        <FaderPrimitive.Track
          className={faderTrackVariants({ size })}
          data-slot="fader-track"
        >
          <FaderPrimitive.Range
            className={cn(
              "cn-fader-range absolute select-none",
              "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
              "data-[orientation=vertical]:bottom-0"
            )}
          />
        </FaderPrimitive.Track>

        <FaderPrimitive.Thumb
          className={faderThumbVariants({ size })}
          data-slot="fader-thumb"
        >
          <FaderPrimitive.ThumbInner
            className={faderThumbInnerVariants({ size })}
            data-slot="fader-thumb-inner"
          >
            {thumbMarks !== false &&
              Array.from({ length: thumbMarks }, (_, i) => (
                <FaderPrimitive.ThumbMark
                  className={faderThumbMarkVariants({ size })}
                  key={String(i)}
                />
              ))}
          </FaderPrimitive.ThumbInner>
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Slider>
    </FaderPrimitive.Root>
  );
}
