import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps, type CSSProperties, useCallback } from "react";
import { cn } from "@/registry/lib/utils";
import { Envelope as EnvelopePrimitive } from "@/registry/primitives/envelope/react";

/**
 * How each part of the envelope is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the envelope's props: the React envelope
 * applies these classes, and `registry:build` writes them as plain CSS on the
 * parts for every other framework. The frame around the envelope carries
 * `data-size`; a point's label, `data-below` when it sits under the point.
 */
export const envelopeParts = Object.freeze({
  "envelope-frame":
    "cn-envelope group/envelope-frame box-border w-full cursor-crosshair touch-none select-none p-3.5 has-data-disabled:pointer-events-none has-data-disabled:opacity-50",
  envelope: "size-full data-disabled:cursor-not-allowed",
  "envelope-graph": "size-full overflow-visible",
  // The curve takes the paint of its svg (the area its fill, the line its stroke): the Vue and Svelte adapters draw it in the current color otherwise.
  "envelope-fill":
    "cn-envelope-fill [&_polyline]:[fill:inherit] [&_polyline]:[stroke:inherit]",
  "envelope-line":
    "cn-envelope-path [stroke-linejoin:round] [&_polyline]:[stroke:inherit]",
  "envelope-segment":
    "cn-envelope-curve group/envelope-segment cursor-ns-resize opacity-0 outline-none after:absolute after:-inset-2 pointer-coarse:opacity-100 pointer-coarse:after:-inset-4 group-focus-within/envelope-frame:opacity-100 group-hover/envelope-frame:opacity-100 data-dragging:opacity-100",
  "envelope-segment-value":
    "cn-envelope-point-value -translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden whitespace-nowrap group-data-dragging/envelope-segment:block",
  "envelope-point":
    "cn-envelope-point group/envelope-point size-4 cursor-grab data-dragging:bg-primary focus-visible:bg-primary touch-none select-none outline-none after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5 active:cursor-grabbing",
  // Near the top the label goes under the point, so it stays inside the page.
  "envelope-point-value":
    "cn-envelope-point-value -translate-x-1/2 pointer-events-none absolute left-1/2 z-10 hidden whitespace-nowrap group-hover/envelope-point:block group-data-dragging/envelope-point:block group-focus-visible/envelope-point:block not-data-below:bottom-full not-data-below:mb-2 data-below:top-full data-below:mt-2",
});

/** The parts whose look changes with the frame's `data-size`, by size. */
export const envelopeSizes = Object.freeze({
  "envelope-frame": Object.freeze({
    default: "cn-envelope-size-default",
    lg: "cn-envelope-size-lg",
    sm: "cn-envelope-size-sm",
  }),
});

const envelopeVariants = cva(envelopeParts["envelope-frame"], {
  defaultVariants: { size: "default" },
  variants: { size: envelopeSizes["envelope-frame"] },
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
function gridLines(
  snap: ComponentProps<typeof EnvelopePrimitive.Root>["snap"]
): CSSProperties {
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

/** The numbers 0 to length - 1: a point has no name but its place. */
const indexes = (length: number) =>
  Array.from({ length: Math.max(length, 0) }, (_, index) => index);

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
  extends Omit<ComponentProps<typeof EnvelopePrimitive.Root>, "children">,
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
      className={cn(envelopeVariants({ size }), className)}
      data-size={size ?? "default"}
      data-slot="envelope-frame"
      style={gridLines(snap)}
    >
      <EnvelopePrimitive.Root
        className={envelopeParts.envelope}
        data-slot="envelope"
        role="group"
        snap={snap}
        {...props}
      >
        {({ value: points }) => (
          <>
            <EnvelopePrimitive.Graph
              className={envelopeParts["envelope-graph"]}
              data-slot="envelope-graph"
            >
              <EnvelopePrimitive.Fill
                className={envelopeParts["envelope-fill"]}
                data-slot="envelope-fill"
              />
              <EnvelopePrimitive.Line
                className={envelopeParts["envelope-line"]}
                data-slot="envelope-line"
              />
            </EnvelopePrimitive.Graph>
            {curves
              ? indexes(points.length - 1).map((index) => (
                  <EnvelopePrimitive.Segment
                    aria-label={`Curve ${index + 1}`}
                    className={envelopeParts["envelope-segment"]}
                    data-slot="envelope-segment"
                    index={index}
                    key={index}
                  >
                    <span
                      aria-hidden="true"
                      className={envelopeParts["envelope-segment-value"]}
                      data-slot="envelope-segment-value"
                    >
                      {describeCurve(points[index]?.curve)}
                    </span>
                  </EnvelopePrimitive.Segment>
                ))
              : null}
            {indexes(points.length).map((index) => {
              const point = points[index];
              if (!point) {
                return null;
              }
              return (
                <EnvelopePrimitive.Point
                  aria-label={`Point ${index + 1} of ${points.length}`}
                  className={envelopeParts["envelope-point"]}
                  data-slot="envelope-point"
                  getAriaValueText={describe}
                  index={index}
                  key={index}
                >
                  <span
                    aria-hidden="true"
                    className={envelopeParts["envelope-point-value"]}
                    data-below={point.y > LABEL_FLIP_ABOVE ? "" : undefined}
                    data-slot="envelope-point-value"
                  >
                    {describe(point)}
                  </span>
                </EnvelopePrimitive.Point>
              );
            })}
          </>
        )}
      </EnvelopePrimitive.Root>
    </div>
  );
}
