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
      <XYPadPrimitive.Slider
        className={cn(
          "relative block w-full cursor-crosshair touch-none select-none overflow-hidden",
          "rounded-2xl border border-transparent bg-card shadow-md ring-1 ring-foreground/5",
          "transition-[color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
          "hover:shadow-md hover:ring-2 hover:ring-ring/50 dark:ring-foreground/10",
          "focus-visible:border-ring focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "active:border-ring active:shadow-md active:ring-2 active:ring-ring",
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

        <XYPadPrimitive.Cursor className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-5 transition-none">
          <XYPadPrimitive.CursorGlow className="absolute inset-0 rounded-full bg-primary opacity-20 blur-sm transition-opacity duration-200 motion-reduce:transition-none" />
          <XYPadPrimitive.CursorDot className="absolute inset-1 rounded-full bg-primary shadow-sm" />
          <XYPadPrimitive.CursorHighlight className="absolute inset-2 rounded-full bg-primary-foreground opacity-30" />
        </XYPadPrimitive.Cursor>

        {valueDisplay === "visible" && (
          <XYPadPrimitive.ValueDisplay
            className={cn(
              "absolute top-2.5 right-2.5 z-10",
              "rounded-2xl bg-background/90 ring-1 ring-foreground/10 backdrop-blur-md",
              "px-2 py-1 font-mono text-muted-foreground text-xs"
            )}
            formatValue={formatValue}
          />
        )}
      </XYPadPrimitive.Slider>
    </XYPadPrimitive.Root>
  );
}
