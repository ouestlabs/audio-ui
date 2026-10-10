"use client";

import { Meter as MeterPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

const meterVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-meter-size-default",
      lg: "cn-meter-size-lg",
      sm: "cn-meter-size-sm",
    },
  },
});

interface MeterProps
  extends MeterPrimitive.Root.Props,
    VariantProps<typeof meterVariants> {
  peakMarks?: "visible" | "hidden";
}

const decibels = (formattedValue: string) => `${formattedValue} dB`;

export function Meter({
  "aria-label": ariaLabel,
  className,
  size,
  peakMarks = "visible",
  ...props
}: MeterProps) {
  return (
    <MeterPrimitive.Root
      aria-label={ariaLabel}
      className={cn(
        "cn-meter flex w-full select-none",
        "gap-1 data-[orientation=horizontal]:flex-col",
        meterVariants({ size }),
        className
      )}
      data-slot="meter"
      {...props}
    >
      <MeterPrimitive.Channels>
        {(index, channelCount) => (
          <MeterPrimitive.Channel
            aria-label={
              ariaLabel && channelCount > 1
                ? `${ariaLabel} ${index + 1}`
                : ariaLabel
            }
            className="cn-meter-channel relative flex-1 overflow-hidden"
            getAriaValueText={decibels}
            index={index}
            key={`meter-channel-${index}`}
          >
            <MeterPrimitive.Indicator className="cn-meter-fill absolute inset-0" />
            {peakMarks === "visible" ? (
              <MeterPrimitive.Peak className="cn-meter-peak absolute data-[orientation=horizontal]:top-0 data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:w-0.5 data-[orientation=vertical]:right-0 data-[orientation=vertical]:left-0 data-[orientation=vertical]:h-0.5" />
            ) : null}
          </MeterPrimitive.Channel>
        )}
      </MeterPrimitive.Channels>
    </MeterPrimitive.Root>
  );
}
