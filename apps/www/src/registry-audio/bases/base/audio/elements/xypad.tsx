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
  extends XYPadPrimitive.RootProps,
    VariantProps<typeof xypadVariants> {
  formatValue?: (value: { x: number; y: number }) => React.ReactNode;
  valueDisplay?: "visible" | "hidden";
}

export function XYPad({
  className,
  size,
  formatValue,
  valueDisplay = "visible",
  ...props
}: XYPadProps) {
  return (
    <XYPadPrimitive.Root {...props}>
      <XYPadPrimitive.Label />
      <XYPadPrimitive.Slider
        className={cn(
          "cn-xypad relative block w-full cursor-crosshair touch-none select-none overflow-hidden",
          "focus-visible:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          xypadVariants({ size }),
          className
        )}
        data-slot="xypad"
      >
        <XYPadPrimitive.Grid className="pointer-events-none absolute inset-0">
          {Array.from({ length: 4 }, (_, i) => {
            const position = ((i + 1) * 100) / 5;
            return (
              <XYPadPrimitive.GridLine
                className={cn(
                  "cn-xypad-grid-line absolute",
                  "data-grid-vertical-line:top-0 data-grid-vertical-line:bottom-0 data-grid-vertical-line:w-px"
                )}
                key={`xypad-grid-v-${position}`}
                orientation="vertical"
                position={position}
              />
            );
          })}
          {Array.from({ length: 4 }, (_, i) => {
            const position = ((i + 1) * 100) / 5;
            return (
              <XYPadPrimitive.GridLine
                className={cn(
                  "cn-xypad-grid-line absolute",
                  "data-grid-horizontal-line:right-0 data-grid-horizontal-line:left-0 data-grid-horizontal-line:h-px"
                )}
                key={`xypad-grid-h-${position}`}
                orientation="horizontal"
                position={position}
              />
            );
          })}
        </XYPadPrimitive.Grid>

        <XYPadPrimitive.Crosshair
          className={cn(
            "cn-xypad-crosshair pointer-events-none absolute",
            "data-crosshair-vertical:top-0 data-crosshair-vertical:bottom-0 data-crosshair-vertical:w-px"
          )}
          orientation="vertical"
        />
        <XYPadPrimitive.Crosshair
          className={cn(
            "cn-xypad-crosshair pointer-events-none absolute",
            "data-crosshair-horizontal:right-0 data-crosshair-horizontal:left-0 data-crosshair-horizontal:h-px"
          )}
          orientation="horizontal"
        />

        <XYPadPrimitive.Cursor className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-5 transition-none">
          <XYPadPrimitive.CursorGlow className="cn-xypad-cursor-glow absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none" />
          <XYPadPrimitive.CursorDot className="cn-xypad-cursor-dot absolute inset-1" />
          <XYPadPrimitive.CursorHighlight className="cn-xypad-cursor-highlight absolute inset-2" />
        </XYPadPrimitive.Cursor>

        {valueDisplay === "visible" && (
          <XYPadPrimitive.ValueDisplay
            className="cn-xypad-value absolute top-2.5 right-2.5 z-10"
            formatValue={formatValue}
          />
        )}
      </XYPadPrimitive.Slider>
    </XYPadPrimitive.Root>
  );
}
