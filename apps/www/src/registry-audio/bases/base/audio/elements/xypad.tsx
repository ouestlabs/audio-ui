"use client";

import { XYPad as XYPadPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const xypadVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-xypad-size-default",
      lg: "cn-xypad-size-lg",
      sm: "cn-xypad-size-sm",
      xl: "cn-xypad-size-xl",
    },
  },
});

interface XYPadProps
  extends XYPadPrimitive.Root.Props,
    VariantProps<typeof xypadVariants> {
  /** Takes the height left in a column, from its size up: the pad gives back space a taller neighbour leaves. */
  fill?: boolean;
  formatValue?: (value: { x: number; y: number }) => React.ReactNode;
  valueDisplay?: "visible" | "hidden";
}

const GRID_LINE_POSITIONS = [20, 40, 60, 80];

export function XYPad({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  fill = false,
  size,
  formatValue,
  valueDisplay = "visible",
  ...props
}: XYPadProps) {
  const valueChildren: XYPadPrimitive.Value.Props["children"] = formatValue
    ? (_formattedX, _formattedY, value) => formatValue(value)
    : undefined;

  return (
    <XYPadPrimitive.Root
      className={cn(
        "data-disabled:cursor-not-allowed",
        fill && "flex grow flex-col"
      )}
      {...props}
    >
      <XYPadPrimitive.Control
        className={cn(
          "cn-xypad relative block w-full cursor-crosshair touch-none select-none overflow-hidden",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          xypadVariants({ size }),
          fill && "grow",
          className
        )}
        data-slot="xypad"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {GRID_LINE_POSITIONS.map((position) => (
            <div
              className="cn-xypad-grid-line absolute top-0 bottom-0 w-px"
              key={`xypad-grid-v-${position}`}
              style={{ left: `${position}%` }}
            />
          ))}
          {GRID_LINE_POSITIONS.map((position) => (
            <div
              className="cn-xypad-grid-line absolute right-0 left-0 h-px"
              key={`xypad-grid-h-${position}`}
              style={{ top: `${position}%` }}
            />
          ))}
        </div>

        <div
          aria-hidden="true"
          className="cn-xypad-crosshair pointer-events-none absolute top-0 bottom-0 left-(--xy-pad-x) w-px"
        />
        <div
          aria-hidden="true"
          className="cn-xypad-crosshair pointer-events-none absolute top-(--xy-pad-y) right-0 left-0 h-px"
        />

        <XYPadPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="pointer-events-none absolute size-5"
          data-slot="xypad-thumb"
        >
          <div className="cn-xypad-cursor-glow absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none" />
          <div className="cn-xypad-cursor-dot absolute inset-1" />
          <div className="cn-xypad-cursor-highlight absolute inset-2" />
        </XYPadPrimitive.Thumb>

        {valueDisplay === "visible" ? (
          <XYPadPrimitive.Value className="cn-xypad-value absolute top-2.5 right-2.5 z-10">
            {valueChildren}
          </XYPadPrimitive.Value>
        ) : null}
      </XYPadPrimitive.Control>
    </XYPadPrimitive.Root>
  );
}
