import {
  type ComponentProps,
  createContext,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { cn } from "@/registry/lib/utils";
import { type PlotAxis, valueOn } from "@/registry/primitives/plot/plot";
import { Plot as PlotPrimitive } from "@/registry/primitives/plot/react";

type RootProps = ComponentProps<typeof PlotPrimitive.Root>;
type HandleCallbacks = Pick<RootProps, "onValueChange" | "onValueCommitted">;

/** What `useValueAtPointer` reads: the plot's element, and its axes. */
const PlotAxes = createContext<{
  axes: {
    x: PlotAxis;
    y: PlotAxis;
  };
  el: RefObject<HTMLDivElement | null>;
  /** What each handle asked to hear of its own changes. */
  handlers: RefObject<Map<string, HandleCallbacks>>;
} | null>(null);

/** The frame: give it a width and a height, draw in it with the parts below. */
function Plot({
  className,
  onValueChange,
  onValueCommitted,
  ...props
}: RootProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const handlers = useRef(new Map<string, HandleCallbacks>());
  // A handle hears its own changes through its props; the plot hears all of them.
  const change = useCallback<NonNullable<RootProps["onValueChange"]>>(
    (value, details) => {
      handlers.current.get(details.handle)?.onValueChange?.(value, details);
      onValueChange?.(value, details);
    },
    [onValueChange]
  );
  const commit = useCallback<NonNullable<RootProps["onValueCommitted"]>>(
    (value, details) => {
      handlers.current.get(details.handle)?.onValueCommitted?.(value, details);
      onValueCommitted?.(value, details);
    },
    [onValueCommitted]
  );
  const { maxX = 1, maxY = 1, minX = 0, minY = 0, scaleX, scaleY } = props;
  const context = useMemo(
    () => ({
      axes: {
        x: { max: maxX, min: minX, scale: scaleX ?? "linear" },
        y: { max: maxY, min: minY, scale: scaleY ?? "linear" },
      },
      el,
      handlers,
    }),
    [maxX, maxY, minX, minY, scaleX, scaleY]
  );
  return (
    <PlotAxes value={context}>
      <PlotPrimitive.Root
        className={cn(
          "cn-plot relative h-48 w-full touch-none select-none data-disabled:opacity-50",
          className
        )}
        data-slot="plot"
        onValueChange={change}
        onValueCommitted={commit}
        ref={el}
        {...props}
      />
    </PlotAxes>
  );
}

/** The layer the parts draw in: it clips them to the frame's corners. */
function PlotGraph({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "cn-plot-graph absolute inset-0 overflow-hidden! rounded-[inherit]",
        className
      )}
      data-slot="plot-graph"
      {...props}
    />
  );
}

/** A curve: `y = fn(x)` across the plot. */
function PlotCurve({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Curve>) {
  return (
    <PlotPrimitive.Curve
      className={cn(
        "cn-plot-curve fill-none [stroke-linecap:round] [stroke-linejoin:round]",
        className
      )}
      data-slot="plot-curve"
      {...props}
    />
  );
}

/** The same, filled down to `fillTo`: draw it under a `PlotCurve`. */
function PlotArea({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Curve>) {
  return (
    <PlotPrimitive.Curve
      className={cn("cn-plot-area stroke-none", className)}
      data-slot="plot-area"
      {...props}
    />
  );
}

/** A live line from a `source`, such as a spectrum: it follows the signal without re-rendering. */
function PlotTrace({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Trace>) {
  return (
    <PlotPrimitive.Trace
      className={cn(
        "cn-plot-trace fill-none [stroke-linecap:round] [stroke-linejoin:round]",
        className
      )}
      data-slot="plot-trace"
      {...props}
    />
  );
}

/** The same, filled down to `fillTo`. */
function PlotTraceArea({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Trace>) {
  return (
    <PlotPrimitive.Trace
      className={cn("cn-plot-trace-area stroke-none", className)}
      data-slot="plot-trace-area"
      {...props}
    />
  );
}

/** Where the signal is right now: the input level on a compressor's curve. */
function PlotDot({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Dot>) {
  return (
    <PlotPrimitive.Dot
      className={cn("cn-plot-dot size-2.5 rounded-full", className)}
      data-slot="plot-dot"
      {...props}
    />
  );
}

/** A rule at a value: 0 dB, a cutoff, a threshold. */
function PlotLine({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Line>) {
  return (
    <PlotPrimitive.Line
      className={cn("cn-plot-line", className)}
      data-slot="plot-line"
      {...props}
    />
  );
}

type PlotCursorProps = Omit<
  ComponentProps<typeof PlotPrimitive.Cursor>,
  "children"
> & {
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
        className="cn-plot-cursor-line absolute inset-y-0 w-px opacity-0 group-data-[active]/cursor:opacity-100"
        style={{ left: "var(--plot-cursor-x)" }}
      />
      <div
        className="cn-plot-cursor-line absolute inset-x-0 h-px opacity-0 group-data-[active]/cursor:opacity-100"
        style={{ top: "var(--plot-cursor-y)" }}
      />
      <PlotPrimitive.CursorReadout
        className="cn-plot-cursor-readout top-1.5! right-2 left-auto! tabular-nums opacity-0 group-data-[active]/cursor:opacity-100"
        format={format}
      />
    </PlotPrimitive.Cursor>
  );
}

/** Grid lines and labels at round values it works out from the axes: pass `x` and `y` to choose which axes, and `ticks` or `format` to choose the values and their text. */
function PlotGrid({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Grid>) {
  return (
    <PlotPrimitive.Grid
      className={cn(
        "cn-plot-grid rounded-[inherit] text-[10px] text-muted-foreground tabular-nums leading-none",
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
function PlotMark({
  axis,
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Mark>) {
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
function PlotBand({
  className,
  ...props
}: ComponentProps<typeof PlotPrimitive.Band>) {
  return (
    <PlotPrimitive.Band
      className={cn("cn-plot-band", className)}
      data-slot="plot-band"
      {...props}
    />
  );
}

type PlotHandleProps = Omit<
  ComponentProps<typeof PlotPrimitive.Handle>,
  "handle"
> &
  HandleCallbacks & {
    /** The handle's name, in what the plot reports. Defaults to one of its own. */
    handle?: string;
  };

/** A point to drag: a band, a cutoff, a threshold. Arrow keys move it too. */
function PlotHandle({
  className,
  handle,
  onValueChange,
  onValueCommitted,
  ...props
}: PlotHandleProps) {
  const own = useId();
  const name = handle ?? own;
  const context = use(PlotAxes);
  useEffect(() => {
    const handlers = context?.handlers.current;
    handlers?.set(name, { onValueChange, onValueCommitted });
    return () => {
      handlers?.delete(name);
    };
  }, [context, name, onValueChange, onValueCommitted]);
  return (
    <PlotPrimitive.Handle
      className={cn(
        "cn-plot-handle size-4 cursor-grab outline-none after:absolute after:-inset-2 pointer-coarse:after:-inset-3.5 data-dragging:cursor-grabbing data-disabled:pointer-events-none",
        className
      )}
      data-slot="plot-handle"
      handle={name}
      {...props}
    />
  );
}

/** Turns a pointer position into a value on the plot, for adding a point where someone double-clicks. Read it inside a `Plot`. */
function useValueAtPointer() {
  const context = use(PlotAxes);
  return useCallback(
    (clientX: number, clientY: number) => {
      const rect = context?.el.current?.getBoundingClientRect();
      if (!(context && rect) || rect.width === 0 || rect.height === 0) {
        return null;
      }
      const across = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width)
      );
      const up = Math.min(
        1,
        Math.max(0, 1 - (clientY - rect.top) / rect.height)
      );
      return {
        x: valueOn(context.axes.x, across),
        y: valueOn(context.axes.y, up),
      };
    },
    [context]
  );
}

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
