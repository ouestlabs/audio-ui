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
  extends XYPadPrimitive.Root.Props,
    VariantProps<typeof xypadVariants> {
  formatValue?: (value: { x: number; y: number }) => React.ReactNode;
  valueDisplay?: "visible" | "hidden";
}

const GRID_LINE_POSITIONS = [20, 40, 60, 80];

export function XYPad({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  size,
  formatValue,
  valueDisplay = "visible",
  ...props
}: XYPadProps) {
  const valueChildren: XYPadPrimitive.Value.Props["children"] = formatValue
    ? (_formattedX, _formattedY, value) => formatValue(value)
    : undefined;

  return (
    <XYPadPrimitive.Root {...props}>
      <XYPadPrimitive.Control
        className={cn(
          "rounded-xl border border-transparent bg-card ring-1 ring-foreground/10 transition-[color,border-color,box-shadow,opacity] duration-150 ease-out hover:ring-3 hover:ring-ring/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 has-focus-visible:border-ring active:border-ring motion-reduce:transition-none relative block w-full cursor-crosshair touch-none select-none overflow-hidden",
          "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
          xypadVariants({ size }),
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
              className="bg-border opacity-30 absolute top-0 bottom-0 w-px"
              key={`xypad-grid-v-${position}`}
              style={{ left: `${position}%` }}
            />
          ))}
          {GRID_LINE_POSITIONS.map((position) => (
            <div
              className="bg-border opacity-30 absolute right-0 left-0 h-px"
              key={`xypad-grid-h-${position}`}
              style={{ top: `${position}%` }}
            />
          ))}
        </div>

        <div
          aria-hidden="true"
          className="bg-primary opacity-50 pointer-events-none absolute top-0 bottom-0 left-(--xy-pad-x) w-px"
        />
        <div
          aria-hidden="true"
          className="bg-primary opacity-50 pointer-events-none absolute top-(--xy-pad-y) right-0 left-0 h-px"
        />

        <XYPadPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="pointer-events-none absolute size-5"
          data-slot="xypad-thumb"
        >
          <div className="rounded-full bg-primary opacity-20 blur-sm absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none" />
          <div className="rounded-full bg-primary shadow-sm absolute inset-1" />
          <div className="rounded-full bg-primary-foreground opacity-30 absolute inset-2" />
        </XYPadPrimitive.Thumb>

        {valueDisplay === "visible" ? (
          <XYPadPrimitive.Value className="rounded-[min(var(--radius-md),10px)] bg-background/90 px-2 py-1 font-mono text-muted-foreground text-xs ring-1 ring-foreground/10 backdrop-blur-md absolute top-2.5 right-2.5 z-10">
            {valueChildren}
          </XYPadPrimitive.Value>
        ) : null}
      </XYPadPrimitive.Control>
    </XYPadPrimitive.Root>
  );
}
