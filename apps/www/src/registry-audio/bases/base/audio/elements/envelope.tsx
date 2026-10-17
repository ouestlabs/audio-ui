"use client";

import { Envelope as EnvelopePrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { type CSSProperties, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const envelopeVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-envelope-size-default",
      lg: "cn-envelope-size-lg",
      sm: "cn-envelope-size-sm",
    },
  },
});

/** The frame's room for the end points, which the grid's lines are measured from. */
const INSET = "0.875rem";
const DEFAULT_GRID_STEP = 0.25;
/** A segment's bend as a signed percentage: positive holds the start of the segment, negative the end. */
const describeCurve = (curve = 0) =>
  `Curve ${curve > 0 ? "+" : ""}${Math.round(curve * 100)}%`;
/** Above this level a point's label sits under it, not over it. */
const LABEL_FLIP_ABOVE = 0.8;

/** A grid step, or the default one where an axis has none. */
const gridStep = (step: number | undefined) =>
  step && step > 0 ? step : DEFAULT_GRID_STEP;

/** A line every step of `snap` across and down, spread over the whole frame like a plot's: they sit on the data's own coordinates, so a point is on a line at 0, ¼, ½, ¾ and 1. */
function gridLines(snap: EnvelopePrimitive.Root.Props["snap"]): CSSProperties {
  const [x, y] = typeof snap === "object" ? [snap.x, snap.y] : [snap, snap];
  const share = (step: number | undefined) =>
    `calc((100% - 2 * ${INSET}) * ${gridStep(step)})`;
  return {
    backgroundImage:
      "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
    backgroundPosition: `${INSET} 0, 0 ${INSET}`,
    backgroundSize: `${share(x)} 100%, 100% ${share(y)}`,
  };
}

type Domain = readonly [number, number];

/** A share of the axis as a value in the axis's own units, to three significant digits. */
function describeAxis(share: number, domain?: Domain, unit = "") {
  const [min, max] = domain ?? [0, 100];
  const value = Number((min + share * (max - min)).toPrecision(3));
  const text = domain ? String(value) : `${Math.round(share * 100)}`;
  const suffix = domain ? unit : "%";
  return suffix === "%" ? `${text}%` : `${text} ${suffix}`.trim();
}

interface EnvelopeProps
  extends EnvelopePrimitive.Root.Props,
    VariantProps<typeof envelopeVariants> {
  /** Whether a handle on each segment bends it. @default true */
  curves?: boolean;
  /** Prints a point's value in the label that shows while it is dragged or focused, and in its accessible value text. Defaults to the values in `xDomain` and `yDomain`, or percentages. */
  formatValue?: (point: { x: number; y: number }) => string;
  /** The values the horizontal axis runs from and to, for the labels: `[0, 2000]` with `xUnit="ms"`. Unset, it reads in percent. */
  xDomain?: Domain;
  xUnit?: string;
  /** The values the vertical axis runs from and to, for the labels. */
  yDomain?: Domain;
  yUnit?: string;
}

/**
 * The frame has room inside it, so the first and last points sit within it
 * instead of on its edge. Drag a point to move it, the small handle on a
 * segment to bend it, and hold Shift for a fine drag. With `snap`, the grid's
 * lines are the snapping ones.
 */
export function Envelope({
  className,
  curves = true,
  formatValue,
  size,
  snap,
  xDomain,
  xUnit,
  yDomain,
  yUnit,
  ...props
}: EnvelopeProps) {
  const describe = useCallback(
    (point: { x: number; y: number }) =>
      formatValue
        ? formatValue(point)
        : `${describeAxis(point.x, xDomain, xUnit)} · ${describeAxis(point.y, yDomain, yUnit)}`,
    [formatValue, xDomain, xUnit, yDomain, yUnit]
  );

  return (
    <div
      className={cn(
        "cn-envelope group/envelope box-border w-full cursor-crosshair touch-none select-none p-3.5",
        "has-data-disabled:pointer-events-none has-data-disabled:opacity-50",
        envelopeVariants({ size }),
        className
      )}
      data-slot="envelope"
      style={gridLines(snap)}
    >
      <EnvelopePrimitive.Root
        className="size-full data-disabled:cursor-not-allowed"
        role="group"
        snap={snap}
        {...props}
      >
        <EnvelopePrimitive.Graph className="size-full overflow-visible">
          <EnvelopePrimitive.Fill className="cn-envelope-fill" />
          <EnvelopePrimitive.Line className="cn-envelope-path [stroke-linejoin:round]" />
        </EnvelopePrimitive.Graph>
        {curves ? (
          <EnvelopePrimitive.Segments>
            {(point, index) => (
              <EnvelopePrimitive.Segment
                aria-label={`Curve ${index + 1}`}
                className="cn-envelope-curve group/segment cursor-ns-resize opacity-0 outline-none after:absolute after:-inset-2 pointer-coarse:opacity-100 pointer-coarse:after:-inset-4 group-focus-within/envelope:opacity-100 group-hover/envelope:opacity-100 data-dragging:opacity-100"
                index={index}
                key={index}
              >
                <span
                  aria-hidden="true"
                  className="cn-envelope-point-value -translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden whitespace-nowrap group-data-dragging/segment:block"
                >
                  {describeCurve(point.curve)}
                </span>
              </EnvelopePrimitive.Segment>
            )}
          </EnvelopePrimitive.Segments>
        ) : null}
        <EnvelopePrimitive.Points>
          {(point, index, points) => (
            <EnvelopePrimitive.Point
              aria-label={`Point ${index + 1} of ${points.length}`}
              className="cn-envelope-point group/point size-4 cursor-grab data-dragging:bg-primary focus-visible:bg-primary touch-none select-none outline-none after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5 active:cursor-grabbing"
              getAriaValueText={describe}
              index={index}
              key={index}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "cn-envelope-point-value -translate-x-1/2 pointer-events-none absolute left-1/2 z-10 hidden whitespace-nowrap group-hover/point:block group-data-dragging/point:block group-focus-visible/point:block",
                  // Near the top the label goes under the point, so it stays inside the page.
                  point.y > LABEL_FLIP_ABOVE
                    ? "top-full mt-2"
                    : "bottom-full mb-2"
                )}
              >
                {describe(point)}
              </span>
            </EnvelopePrimitive.Point>
          )}
        </EnvelopePrimitive.Points>
      </EnvelopePrimitive.Root>
    </div>
  );
}
