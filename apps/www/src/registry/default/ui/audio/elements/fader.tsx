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
  "relative grow cursor-pointer select-none overflow-hidden rounded-full bg-input/90",
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

const faderThumbVariants = cva(
  "before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none rounded-[calc(var(--radius)+0.375rem)] bg-white not-dark:bg-clip-padding shadow-md ring-1 ring-black/10 transition-[color,box-shadow,background-color] before:absolute before:content-[''] hover:ring-4 hover:ring-ring/30 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-ring/30 active:cursor-grabbing data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed motion-reduce:transition-none dark:bg-card dark:ring-foreground/10",
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
          "data-[orientation=horizontal]:h-3.5 data-[orientation=vertical]:h-5 data-[orientation=horizontal]:w-5 data-[orientation=vertical]:w-3.5",
      },
      {
        size: "default",
        class:
          "data-[orientation=horizontal]:h-4 data-[orientation=vertical]:h-6 data-[orientation=horizontal]:w-6 data-[orientation=vertical]:w-4",
      },
      {
        size: "lg",
        class:
          "data-[orientation=horizontal]:h-5 data-[orientation=vertical]:h-7 data-[orientation=horizontal]:w-7 data-[orientation=vertical]:w-5",
      },
    ],
    defaultVariants: {
      size: "default",
    },
  }
);

const faderThumbMarkVariants = cva("bg-primary opacity-50", {
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
        "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-2.5",
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
        <FaderPrimitive.Track className={faderTrackVariants({ size })}>
          <FaderPrimitive.Range
            className={cn(
              "absolute select-none bg-primary",
              "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
              "data-[orientation=vertical]:bottom-0"
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
              "data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:px-1.5 data-[orientation=horizontal]:py-1",
              "data-[orientation=vertical]:flex-col data-[orientation=vertical]:px-1 data-[orientation=vertical]:py-1.5",
              size === "sm" &&
                "data-[orientation=horizontal]:px-1 data-[orientation=vertical]:px-0.5 data-[orientation=horizontal]:py-0.5 data-[orientation=vertical]:py-1",
              size === "lg" &&
                "data-[orientation=horizontal]:px-2 data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:py-2"
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
