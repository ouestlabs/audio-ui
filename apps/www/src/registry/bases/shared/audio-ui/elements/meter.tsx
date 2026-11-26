import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/registry/lib/utils";
import { Meter as MeterPrimitive } from "@/registry/primitives/meter/react";

/**
 * How each part of the meter is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the meter's props: the React meter applies
 * these classes, and `registry:build` writes them as plain CSS on the parts for
 * every other framework. The root carries `data-orientation`, `data-size` and
 * `data-marks` when it has a scale.
 */
export const meterParts = {
  // Room for the scale's labels beside the channels.
  meter:
    "cn-meter flex select-none gap-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-fit data-[orientation=horizontal]:flex-col data-marks:data-[orientation=vertical]:me-8 data-marks:data-[orientation=horizontal]:mb-6",
  "meter-channel":
    "cn-meter-channel relative flex-1 overflow-hidden data-[orientation=horizontal]:h-(--meter-thickness,auto) data-[orientation=horizontal]:flex-none data-[orientation=vertical]:w-(--meter-thickness,auto) data-[orientation=vertical]:flex-none",
  "meter-indicator": "cn-meter-fill absolute inset-0",
  "meter-peak":
    "cn-meter-peak absolute data-[orientation=horizontal]:top-0 data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:w-0.5 data-[orientation=vertical]:right-0 data-[orientation=vertical]:left-0 data-[orientation=vertical]:h-0.5",
  "meter-mark":
    "cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col",
  "meter-mark-tick":
    "bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5",
  "meter-mark-label":
    "min-w-4 text-end data-[orientation=horizontal]:text-center",
} as const;

/** The parts whose look changes with the meter's `data-size`, by size. */
export const meterSizes = {
  meter: {
    default: "cn-meter-size-default",
    lg: "cn-meter-size-lg",
    sm: "cn-meter-size-sm",
  },
} as const;

const meterVariants = cva(meterParts.meter, {
  defaultVariants: { size: "default" },
  variants: { size: meterSizes.meter },
});

export interface MeterProps
  extends Omit<ComponentProps<typeof MeterPrimitive.Root>, "children">,
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
      className={cn(meterVariants({ size }), className)}
      data-marks={marks ? "labels" : undefined}
      data-size={size ?? "default"}
      data-slot="meter"
      orientation={orientation}
      scale={scale}
      {...props}
    >
      {({ channelCount }) => (
        <>
          {Array.from({ length: channelCount }, (_, index) => index).map(
            (index) => (
              <MeterPrimitive.Channel
                aria-label={
                  ariaLabel && channelCount > 1
                    ? `${ariaLabel} ${index + 1}`
                    : ariaLabel
                }
                className={meterParts["meter-channel"]}
                getAriaValueText={decibels}
                index={index}
                key={index}
              >
                <MeterPrimitive.Indicator
                  className={meterParts["meter-indicator"]}
                />
                {peakMarks === "visible" ? (
                  <MeterPrimitive.Peak className={meterParts["meter-peak"]} />
                ) : null}
              </MeterPrimitive.Channel>
            )
          )}
          {marks?.map((level) => (
            <MeterPrimitive.Mark
              className={meterParts["meter-mark"]}
              key={level}
              value={level}
            >
              <span
                aria-hidden="true"
                className={meterParts["meter-mark-tick"]}
                data-orientation={orientation}
                data-slot="meter-mark-tick"
              />
              <span
                className={meterParts["meter-mark-label"]}
                data-slot="meter-mark-label"
              >
                {level}
              </span>
            </MeterPrimitive.Mark>
          ))}
        </>
      )}
    </MeterPrimitive.Root>
  );
}
