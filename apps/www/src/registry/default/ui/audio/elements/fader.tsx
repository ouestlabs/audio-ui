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
    },
    compoundVariants: [
      {
        size: "sm",
        class:
          "data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2",
      },
      {
        size: "default",
        class:
          "data-[orientation=horizontal]:h-3 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-3",
      },
      {
        size: "lg",
        class:
          "data-[orientation=horizontal]:h-4 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-4",
      },
    ],
    defaultVariants: {
      size: "default",
    },
  }
);

const faderThumbVariants = cva(
  "before:-inset-2 absolute block shrink-0 cursor-grab rounded-md border border-border bg-card shadow-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out before:absolute before:content-[''] hover:ring-2 hover:ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing active:border-ring active:ring-2 active:ring-ring motion-reduce:transition-none",
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
          "data-[orientation=horizontal]:h-7 data-[orientation=vertical]:h-4 data-[orientation=horizontal]:w-4 data-[orientation=vertical]:w-7",
      },
      {
        size: "default",
        class:
          "data-[orientation=horizontal]:h-9 data-[orientation=vertical]:h-5 data-[orientation=horizontal]:w-5 data-[orientation=vertical]:w-9",
      },
      {
        size: "lg",
        class:
          "data-[orientation=horizontal]:h-11 data-[orientation=vertical]:h-6 data-[orientation=horizontal]:w-6 data-[orientation=vertical]:w-11",
      },
    ],
    defaultVariants: {
      size: "default",
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
  },
  compoundVariants: [
    {
      size: "sm",
      class:
        "data-[orientation=horizontal]:h-3 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-3",
    },
    {
      size: "default",
      class:
        "data-[orientation=horizontal]:h-4 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-4",
    },
    {
      size: "lg",
      class:
        "data-[orientation=horizontal]:h-5 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-5",
    },
  ],
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
      className={cn("relative", className)}
      orientation={orientation}
      {...props}
    >
      <FaderPrimitive.Slider
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-32 data-[orientation=vertical]:w-full data-[orientation=vertical]:flex-col",
          "data-[orientation=horizontal]:h-full data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          faderVariants({ size })
        )}
      >
        <FaderPrimitive.Track className={faderTrackVariants({ size })}>
          <FaderPrimitive.Range
            className={cn(
              "absolute bg-primary",
              "data-[orientation=horizontal]:h-full",
              "data-[orientation=vertical]:bottom-0 data-[orientation=vertical]:w-full"
            )}
          />
        </FaderPrimitive.Track>

        <FaderPrimitive.Thumb
          className={cn(
            faderThumbVariants({ size }),
            "data-[disabled=true]:cursor-not-allowed"
          )}
        >
          <FaderPrimitive.ThumbInner
            className={cn(
              "flex h-full w-full items-center justify-center gap-0.5",
              "data-[orientation=horizontal]:flex-row",
              "data-[orientation=vertical]:flex-col"
            )}
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
