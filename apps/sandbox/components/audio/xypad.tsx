"use client";

import { XYPad as XYPadPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const xypadVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "h-48",
      lg: "h-64",
      sm: "h-40",
      xl: "h-96",
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
          "rounded-xl border border-transparent bg-card ring-1 ring-foreground/10 transition-[color,border-color,box-shadow,opacity] duration-150 ease-out hover:ring-3 hover:ring-ring/50 focus-visible:ring-3 focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 focus-visible:border-ring active:border-ring motion-reduce:transition-none relative block w-full cursor-crosshair touch-none select-none overflow-hidden",
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
                  "bg-border opacity-30 absolute",
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
                  "bg-border opacity-30 absolute",
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
            "bg-primary opacity-50 pointer-events-none absolute",
            "data-crosshair-vertical:top-0 data-crosshair-vertical:bottom-0 data-crosshair-vertical:w-px"
          )}
          orientation="vertical"
        />
        <XYPadPrimitive.Crosshair
          className={cn(
            "bg-primary opacity-50 pointer-events-none absolute",
            "data-crosshair-horizontal:right-0 data-crosshair-horizontal:left-0 data-crosshair-horizontal:h-px"
          )}
          orientation="horizontal"
        />

        <XYPadPrimitive.Cursor className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute size-5 transition-none">
          <XYPadPrimitive.CursorGlow className="rounded-full bg-primary opacity-20 blur-sm absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none" />
          <XYPadPrimitive.CursorDot className="rounded-full bg-primary shadow-sm absolute inset-1" />
          <XYPadPrimitive.CursorHighlight className="rounded-full bg-primary-foreground opacity-30 absolute inset-2" />
        </XYPadPrimitive.Cursor>

        {valueDisplay === "visible" && (
          <XYPadPrimitive.ValueDisplay
            className="rounded-[min(var(--radius-md),10px)] bg-background/90 px-2 py-1 font-mono text-muted-foreground text-xs ring-1 ring-foreground/10 backdrop-blur-md absolute top-2.5 right-2.5 z-10"
            formatValue={formatValue}
          />
        )}
      </XYPadPrimitive.Slider>
    </XYPadPrimitive.Root>
  );
}
