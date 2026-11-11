"use client";

import { Plot as PlotPrimitive } from "@audio-ui/react";
import { cn } from "@/lib/utils";

/** The frame: give it a width and a height, draw in it with the parts below. */
function Plot({ className, ...props }: PlotPrimitive.Root.Props) {
  return (
    <PlotPrimitive.Root
      className={cn(
        "rounded-xl border bg-card relative h-48 w-full touch-none select-none data-disabled:opacity-50",
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
      className={cn(
        "text-primary overflow-hidden! rounded-[inherit]",
        className
      )}
      data-slot="plot-graph"
      {...props}
    />
  );
}

/** A curve: `y = fn(x)` across the plot. */
function PlotCurve({ className, ...props }: PlotPrimitive.Curve.Props) {
  return (
    <PlotPrimitive.Curve
      className={cn(
        "stroke-primary stroke-[1.5px] fill-none [stroke-linecap:round] [stroke-linejoin:round]",
        className
      )}
      data-slot="plot-curve"
      {...props}
    />
  );
}

/** The same, filled down to `fillTo`: draw it under a `PlotCurve`. */
function PlotArea({ className, ...props }: PlotPrimitive.Curve.Props) {
  return (
    <PlotPrimitive.Curve
      className={cn("fill-primary/15 stroke-none", className)}
      data-slot="plot-area"
      {...props}
    />
  );
}

/** A live line from a `source`, such as a spectrum: it follows the signal without re-rendering. */
function PlotTrace({ className, ...props }: PlotPrimitive.Trace.Props) {
  return (
    <PlotPrimitive.Trace
      className={cn(
        "stroke-primary/40 stroke-1 fill-none [stroke-linecap:round] [stroke-linejoin:round]",
        className
      )}
      data-slot="plot-trace"
      {...props}
    />
  );
}

/** The same, filled down to `fillTo`. */
function PlotTraceArea({ className, ...props }: PlotPrimitive.Trace.Props) {
  return (
    <PlotPrimitive.Trace
      className={cn("fill-primary/10 stroke-none", className)}
      data-slot="plot-trace-area"
      {...props}
    />
  );
}

/** Where the signal is right now: the input level on a compressor's curve. */
function PlotDot({ className, ...props }: PlotPrimitive.Dot.Props) {
  return (
    <PlotPrimitive.Dot
      className={cn(
        "rounded-full bg-primary ring-4 ring-primary/25 size-2.5",
        className
      )}
      data-slot="plot-dot"
      {...props}
    />
  );
}

/** A rule at a value: 0 dB, a cutoff, a threshold. */
function PlotLine({ className, ...props }: PlotPrimitive.Line.Props) {
  return (
    <PlotPrimitive.Line
      className={cn("stroke-border", className)}
      data-slot="plot-line"
      {...props}
    />
  );
}

type PlotCursorProps = Omit<PlotPrimitive.Cursor.Props, "children"> & {
  /** Turns the value under the pointer, in the axes' units, into the text shown in the corner. */
  format: (value: { x: number; y: number }) => string;
};

/** Crosshair lines and a readout of what is under the pointer, for mouse and pen. */
function PlotCursor({ className, format, ...props }: PlotCursorProps) {
  return (
    <PlotPrimitive.Cursor
      className={cn("group/cursor", className)}
      data-slot="plot-cursor"
      {...props}
    >
      <div
        className="bg-foreground/25 absolute inset-y-0 w-px opacity-0 group-data-[active]/cursor:opacity-100"
        style={{ left: "var(--plot-cursor-x)" }}
      />
      <div
        className="bg-foreground/25 absolute inset-x-0 h-px opacity-0 group-data-[active]/cursor:opacity-100"
        style={{ top: "var(--plot-cursor-y)" }}
      />
      <PlotPrimitive.CursorReadout
        className="rounded-sm bg-card/80 px-1 font-mono text-[10px] text-muted-foreground tabular-nums opacity-0 group-data-[active]/cursor:opacity-100"
        format={format}
        style={{ left: "auto", right: "0.5rem", top: "0.375rem" }}
      />
    </PlotPrimitive.Cursor>
  );
}

/** Grid lines and labels at round values it works out from the axes: pass `x` and `y` to choose which axes, and `ticks` or `format` to choose the values and their text. */
function PlotGrid({ className, ...props }: PlotPrimitive.Grid.Props) {
  return (
    <PlotPrimitive.Grid
      className={cn(
        "text-muted-foreground rounded-[inherit] text-[10px] tabular-nums leading-none",
        // The lines at the edges (0 dB, the dry sound) follow the rounded corners of the frame.
        "[&>svg]:overflow-hidden! [&>svg]:rounded-[inherit]",
        "[&_[data-part=line]]:stroke-border [&_[data-part=line][data-zero]]:stroke-foreground/30",
        // A halo in the surface colour keeps a label readable over the curve without hiding any of it.
        "[&_[data-part=label]]:z-1 [&_[data-part=label]]:px-0.5 [&_[data-part=label]]:[text-shadow:0_0_2px_var(--card),0_0_2px_var(--card),0_0_4px_var(--card)]",
        "[&_[data-part=label][data-axis=x]]:-translate-x-1/2 [&_[data-part=label][data-axis=x]]:bottom-1.5",
        "[&_[data-part=label][data-axis=y]]:-translate-y-1/2 [&_[data-part=label][data-axis=y]]:left-2",
        className
      )}
      data-slot="plot-grid"
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
        "bg-card/80 px-0.5 text-muted-foreground text-[10px] tabular-nums leading-none",
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
      className={cn("fill-foreground/5", className)}
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
        "rounded-full border-2 border-primary bg-background shadow-xs data-active:bg-primary transition-[box-shadow] duration-150 ease-out hover:ring-4 hover:ring-ring/30 focus-within:ring-4 focus-within:ring-ring/30 data-dragging:ring-4 data-dragging:ring-ring/30 motion-reduce:transition-none size-4 cursor-grab outline-none after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5 data-dragging:cursor-grabbing data-disabled:pointer-events-none",
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
  PlotCursor,
  PlotCurve,
  PlotDot,
  PlotGraph,
  PlotGrid,
  PlotHandle,
  PlotLine,
  PlotMark,
  PlotTrace,
  PlotTraceArea,
  useValueAtPointer,
};
