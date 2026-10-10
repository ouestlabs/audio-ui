"use client";

import { Plot as PlotPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";

/** The frame: give it a width and a height, draw in it with the parts below. */
function Plot({ className, ...props }: PlotPrimitive.Root.Props) {
  return (
    <PlotPrimitive.Root
      className={cn(
        "cn-plot relative h-48 w-full touch-none select-none data-disabled:opacity-50",
        className
      )}
      data-slot="plot"
      {...props}
    />
  );
}

function PlotGraph({ className, ...props }: PlotPrimitive.Graph.Props) {
  return (
    <PlotPrimitive.Graph
      className={cn("cn-plot-graph", className)}
      data-slot="plot-graph"
      {...props}
    />
  );
}

/** A curve: `y = fn(x)` across the plot. */
function PlotCurve({ className, ...props }: PlotPrimitive.Curve.Props) {
  return (
    <PlotPrimitive.Curve
      className={cn("cn-plot-curve fill-none", className)}
      data-slot="plot-curve"
      {...props}
    />
  );
}

/** The same, filled down to `fillTo`: draw it under a `PlotCurve`. */
function PlotArea({ className, ...props }: PlotPrimitive.Curve.Props) {
  return (
    <PlotPrimitive.Curve
      className={cn("cn-plot-area stroke-none", className)}
      data-slot="plot-area"
      {...props}
    />
  );
}

/** A live line from a `source`, such as a spectrum: it follows the signal without re-rendering. */
function PlotTrace({ className, ...props }: PlotPrimitive.Trace.Props) {
  return (
    <PlotPrimitive.Trace
      className={cn("cn-plot-trace fill-none", className)}
      data-slot="plot-trace"
      {...props}
    />
  );
}

/** The same, filled down to `fillTo`. */
function PlotTraceArea({ className, ...props }: PlotPrimitive.Trace.Props) {
  return (
    <PlotPrimitive.Trace
      className={cn("cn-plot-trace-area stroke-none", className)}
      data-slot="plot-trace-area"
      {...props}
    />
  );
}

/** Where the signal is right now: the input level on a compressor's curve. */
function PlotDot({ className, ...props }: PlotPrimitive.Dot.Props) {
  return (
    <PlotPrimitive.Dot
      className={cn("cn-plot-dot size-2.5 rounded-full", className)}
      data-slot="plot-dot"
      {...props}
    />
  );
}

/** A rule at a value: 0 dB, a cutoff, a threshold. */
function PlotLine({ className, ...props }: PlotPrimitive.Line.Props) {
  return (
    <PlotPrimitive.Line
      className={cn("cn-plot-line", className)}
      data-slot="plot-line"
      {...props}
    />
  );
}

/** A label at a value on an axis: "1k" under a frequency, "+12" by a gain. */
function PlotMark({ axis, className, ...props }: PlotPrimitive.Mark.Props) {
  return (
    <PlotPrimitive.Mark
      axis={axis}
      className={cn(
        "cn-plot-mark text-[10px] tabular-nums leading-none",
        axis === "x"
          ? "bottom-1.5 -translate-x-1/2"
          : "left-2 -translate-y-1/2",
        className
      )}
      data-slot="plot-mark"
      {...props}
    />
  );
}

/** A shaded stretch of one axis. */
function PlotBand({ className, ...props }: PlotPrimitive.Band.Props) {
  return (
    <PlotPrimitive.Band
      className={cn("cn-plot-band", className)}
      data-slot="plot-band"
      {...props}
    />
  );
}

/** A point to drag: a band, a cutoff, a threshold. Arrow keys move it too. */
function PlotHandle({ className, ...props }: PlotPrimitive.Handle.Props) {
  return (
    <PlotPrimitive.Handle
      className={cn(
        "cn-plot-handle size-4 cursor-grab outline-none after:absolute after:-inset-2 data-dragging:cursor-grabbing data-disabled:pointer-events-none",
        className
      )}
      data-slot="plot-handle"
      {...props}
    />
  );
}

/** Turns a pointer position into a value on the plot, for adding a point where someone double-clicks. */
const { useValueAtPointer } = PlotPrimitive;

export {
  Plot,
  PlotArea,
  PlotBand,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotHandle,
  PlotLine,
  PlotMark,
  PlotTrace,
  PlotTraceArea,
  useValueAtPointer,
};
