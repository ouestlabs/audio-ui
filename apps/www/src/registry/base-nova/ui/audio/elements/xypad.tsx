"use client";

import { XYPad as XYPadPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/registry/default/lib/utils";

const xypadVariants = cva("", {
  variants: {
    size: {
      sm: "h-40",
      default: "h-48",
      lg: "h-64",
      xl: "h-96",
    },
  },
  defaultVariants: {
    size: "default",
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
      {/* nova: rounded-lg (not rounded-2xl), ring-ring/50, border-input visible border */}
      <XYPadPrimitive.Slider
        className={cn(
          "relative block w-full cursor-crosshair touch-none select-none overflow-hidden",
          "rounded-lg border border-input bg-card shadow-sm ring-1 ring-foreground/5",
          "transition-[color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
          "hover:shadow-sm hover:ring-2 hover:ring-ring/50 dark:ring-foreground/10",
          "focus-visible:border-ring focus-visible:shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          "active:border-ring active:shadow-sm active:ring-2 active:ring-ring",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
          xypadVariants({ size }),
          className
        )}
      >
        <XYPadPrimitive.Grid className="pointer-events-none absolute inset-0">
          {Array.from({ length: 4 }, (_, i) => {
            const position = ((i + 1) * 100) / 5;
            return (
              <XYPadPrimitive.GridLine
                className={cn(
                  "absolute bg-border opacity-30",
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
                  "absolute bg-border opacity-30",
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
            "pointer-events-none absolute bg-primary opacity-50",
            "data-crosshair-vertical:top-0 data-crosshair-vertical:bottom-0 data-crosshair-vertical:w-px"
          )}
          orientation="vertical"
        />
        <XYPadPrimitive.Crosshair
          className={cn(
            "pointer-events-none absolute bg-primary opacity-50",
            "data-crosshair-horizontal:right-0 data-crosshair-horizontal:left-0 data-crosshair-horizontal:h-px"
          )}
          orientation="horizontal"
        />

        <XYPadPrimitive.Cursor className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-4 transition-none">
          <XYPadPrimitive.CursorGlow className="absolute inset-0 rounded-sm bg-primary opacity-20 blur-sm transition-opacity duration-200 motion-reduce:transition-none" />
          <XYPadPrimitive.CursorDot className="absolute inset-0.5 rounded-sm bg-primary shadow-sm" />
          <XYPadPrimitive.CursorHighlight className="absolute inset-1.5 rounded-sm bg-primary-foreground opacity-30" />
        </XYPadPrimitive.Cursor>

        {valueDisplay === "visible" && (
          <XYPadPrimitive.ValueDisplay
            className={cn(
              "absolute top-2 right-2 z-10",
              "rounded-md bg-background/90 ring-1 ring-foreground/10 backdrop-blur-md",
              "px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
            )}
            formatValue={formatValue}
          />
        )}
      </XYPadPrimitive.Slider>
    </XYPadPrimitive.Root>
  );
}
