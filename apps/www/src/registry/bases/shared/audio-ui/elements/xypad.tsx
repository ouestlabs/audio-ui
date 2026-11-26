import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/registry/lib/utils";
import { XYPad as XYPadPrimitive } from "@/registry/primitives/xypad/react";

/**
 * How each part of the XY pad is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the pad's props: the React pad applies these
 * classes, and `registry:build` writes them as plain CSS on the parts for
 * every other framework. The root carries `data-size` and, when it fills a
 * column, `data-fill`; a line of the grid or of the crosshair carries its
 * `data-orientation`.
 */
export const xypadParts = Object.freeze({
  xypad:
    "data-disabled:cursor-not-allowed data-fill:flex data-fill:min-h-0 data-fill:grow data-fill:flex-col",
  // Filling, it takes the room it is given, down to a strip, rather than a size's height.
  "xypad-control":
    "cn-xypad relative block w-full cursor-crosshair touch-none select-none overflow-hidden data-disabled:pointer-events-none data-disabled:opacity-50 in-data-fill:min-h-16 in-data-fill:grow in-data-fill:basis-0",
  "xypad-grid": "pointer-events-none absolute inset-0",
  "xypad-grid-line":
    "cn-xypad-grid-line absolute data-[orientation=horizontal]:inset-x-0 data-[orientation=vertical]:inset-y-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px",
  "xypad-crosshair":
    "cn-xypad-crosshair pointer-events-none absolute data-[orientation=horizontal]:inset-x-0 data-[orientation=vertical]:inset-y-0 data-[orientation=vertical]:left-(--xy-pad-x) data-[orientation=horizontal]:top-(--xy-pad-y) data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px",
  "xypad-thumb": "pointer-events-none absolute size-5",
  "xypad-cursor-glow":
    "cn-xypad-cursor-glow absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none",
  "xypad-cursor-dot": "cn-xypad-cursor-dot absolute inset-1",
  "xypad-cursor-highlight": "cn-xypad-cursor-highlight absolute inset-2",
  "xypad-value": "cn-xypad-value absolute top-2.5 right-2.5 z-10",
});

/** The parts whose look changes with the pad's `data-size`, by size. */
export const xypadSizes = Object.freeze({
  "xypad-control": Object.freeze({
    default: "cn-xypad-size-default",
    lg: "cn-xypad-size-lg",
    sm: "cn-xypad-size-sm",
    xl: "cn-xypad-size-xl",
  }),
});

const xypadVariants = cva("", {
  defaultVariants: { size: "default" },
  variants: { size: xypadSizes["xypad-control"] },
});

interface XYPadProps
  extends React.ComponentProps<typeof XYPadPrimitive.Root>,
    VariantProps<typeof xypadVariants> {
  /** Takes the height left in a column in place of its size's, down to a strip: in a short panel it gives way to the controls under it. */
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
  const valueChildren: React.ComponentProps<
    typeof XYPadPrimitive.Value
  >["children"] = formatValue ? ({ value }) => formatValue(value) : undefined;

  return (
    <XYPadPrimitive.Root
      className={xypadParts.xypad}
      data-fill={fill ? "" : undefined}
      data-size={size ?? "default"}
      data-slot="xypad"
      {...props}
    >
      <XYPadPrimitive.Control
        className={cn(
          xypadParts["xypad-control"],
          fill ? undefined : xypadVariants({ size }),
          className
        )}
        data-slot="xypad-control"
      >
        <div
          aria-hidden="true"
          className={xypadParts["xypad-grid"]}
          data-slot="xypad-grid"
        >
          {GRID_LINE_POSITIONS.map((position) => (
            <div
              className={xypadParts["xypad-grid-line"]}
              data-orientation="vertical"
              data-slot="xypad-grid-line"
              key={`xypad-grid-v-${position}`}
              style={{ left: `${position}%` }}
            />
          ))}
          {GRID_LINE_POSITIONS.map((position) => (
            <div
              className={xypadParts["xypad-grid-line"]}
              data-orientation="horizontal"
              data-slot="xypad-grid-line"
              key={`xypad-grid-h-${position}`}
              style={{ top: `${position}%` }}
            />
          ))}
        </div>

        <div
          aria-hidden="true"
          className={xypadParts["xypad-crosshair"]}
          data-orientation="vertical"
          data-slot="xypad-crosshair"
        />
        <div
          aria-hidden="true"
          className={xypadParts["xypad-crosshair"]}
          data-orientation="horizontal"
          data-slot="xypad-crosshair"
        />

        <XYPadPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={xypadParts["xypad-thumb"]}
          data-slot="xypad-thumb"
        >
          <div
            className={xypadParts["xypad-cursor-glow"]}
            data-slot="xypad-cursor-glow"
          />
          <div
            className={xypadParts["xypad-cursor-dot"]}
            data-slot="xypad-cursor-dot"
          />
          <div
            className={xypadParts["xypad-cursor-highlight"]}
            data-slot="xypad-cursor-highlight"
          />
        </XYPadPrimitive.Thumb>

        {valueDisplay === "visible" ? (
          <XYPadPrimitive.Value
            className={xypadParts["xypad-value"]}
            data-slot="xypad-value"
          >
            {valueChildren}
          </XYPadPrimitive.Value>
        ) : null}
      </XYPadPrimitive.Control>
    </XYPadPrimitive.Root>
  );
}
