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
  /** Levels graduated along the meter's length, such as `[-48, -24, -12, -6, 0]`, each with its label. */
  marks?: readonly number[];
  peakMarks?: "visible" | "hidden";
}

const decibels = (formattedValue: string) => `${formattedValue} dB`;

export function Meter({
  "aria-label": ariaLabel,
  className,
  marks,
  orientation = "vertical",
  scale = "iec",
  size,
  peakMarks = "visible",
  ...props
}: MeterProps) {
  return (
    <MeterPrimitive.Root
      aria-label={ariaLabel}
      className={cn(
        "cn-meter flex select-none data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-fit",
        "gap-1 data-[orientation=horizontal]:flex-col",
        // Room for the scale's labels beside the channels.
        marks &&
          "data-[orientation=vertical]:me-8 data-[orientation=horizontal]:mb-6",
        meterVariants({ size }),
        className
      )}
      data-slot="meter"
      orientation={orientation}
      scale={scale}
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
            className="cn-meter-channel relative flex-1 overflow-hidden data-[orientation=horizontal]:h-(--meter-thickness,auto) data-[orientation=horizontal]:flex-none data-[orientation=vertical]:w-(--meter-thickness,auto) data-[orientation=vertical]:flex-none"
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
      {marks?.map((level) => (
        <MeterPrimitive.Mark
          className="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
          key={level}
          value={level}
        >
          <span
            aria-hidden="true"
            className="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
            data-orientation={orientation}
          />
          <span className="min-w-4 text-end data-[orientation=horizontal]:text-center">
            {level}
          </span>
        </MeterPrimitive.Mark>
      ))}
    </MeterPrimitive.Root>
  );
}
