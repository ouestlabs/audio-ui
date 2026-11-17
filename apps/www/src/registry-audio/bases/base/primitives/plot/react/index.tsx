import { createParts } from "@ui-sdk/react/primitive";
import {
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  useCallback,
} from "react";
import {
  type BandState,
  type GridState,
  type HandleState,
  type LineState,
  type PathState,
  plot,
} from "@/primitives/plot";

const noop = () => undefined;

/** The parts that are native inputs: `input`, `rulerInput`, `inputX`. */
const INPUT_PART = /input[xy]?$/i;

/**
 * The kernel listens to the native inputs itself, so React sees a `value` and
 * no `onChange`: this tells it the field is read elsewhere, and keeps it from
 * warning of one.
 */
function quietInputs<Parts extends object>(source: Parts): Parts {
  const quiet: Record<string, unknown> = {};
  for (const [name, Part] of Object.entries(source)) {
    const Component = Part as ComponentType<{ onChange?: () => void }>;
    quiet[name] = INPUT_PART.test(name)
      ? (props: object) => <Component {...props} onChange={noop} />
      : Part;
  }
  return quiet as Parts;
}

/** Which element each part is. */
const parts = quietInputs(
  createParts(plot, {
    band: "svg",
    curve: "svg",
    cursor: "div",
    cursorReadout: "div",
    dot: "div",
    grid: "div",
    handle: "div",
    inputX: "input",
    inputY: "input",
    line: "svg",
    mark: "div",
    root: "div",
    trace: "svg",
  })
);

/** A path that keeps its width however the plot is stretched. */
const NON_SCALING = { vectorEffect: "non-scaling-stroke" } as const;

/** A curve across the plot: `y = fn(x)` in the axes' units. Style its `stroke` and `fill`. */
function Curve(props: ComponentProps<typeof parts.Curve>) {
  return (
    <parts.Curve {...props}>
      {({ d }: PathState) => (
        <path d={d} data-plot="path" style={NON_SCALING} />
      )}
    </parts.Curve>
  );
}

/** A live line across the plot, drawn straight in the DOM from a source. Style its `stroke` and `fill`. */
function Trace(props: ComponentProps<typeof parts.Trace>) {
  return (
    <parts.Trace {...props}>
      {({ d }: PathState) => (
        <path d={d} data-plot="path" style={NON_SCALING} />
      )}
    </parts.Trace>
  );
}

/** A straight line across the plot at a value. Style its `stroke`. */
function Line(props: ComponentProps<typeof parts.Line>) {
  return (
    <parts.Line {...props}>
      {({ x1, x2, y1, y2 }: LineState) => (
        <line style={NON_SCALING} x1={x1} x2={x2} y1={y1} y2={y2} />
      )}
    </parts.Line>
  );
}

/** A stretch of the plot between two values on one axis. Style its `fill`. */
function Band(props: ComponentProps<typeof parts.Band>) {
  return (
    <parts.Band {...props}>
      {({ height, width, x, y }: BandState) => (
        <rect height={height} width={width} x={x} y={y} />
      )}
    </parts.Band>
  );
}

/** Grid lines and their labels: `data-part="line"` and `data-part="label"`, each with `data-axis`. */
function Grid(props: ComponentProps<typeof parts.Grid>) {
  return (
    <parts.Grid {...props}>
      {({ columns, rows }: GridState) => (
        <>
          <svg
            aria-hidden="true"
            height="100%"
            preserveAspectRatio="none"
            style={{ inset: 0, overflow: "visible", position: "absolute" }}
            viewBox="0 0 1 1"
            width="100%"
          >
            {columns.map((tick) => (
              <line
                data-axis="x"
                data-part="line"
                data-zero={tick.value === 0 || undefined}
                key={`x-${tick.value}`}
                style={NON_SCALING}
                x1={tick.position}
                x2={tick.position}
                y1={0}
                y2={1}
              />
            ))}
            {rows.map((tick) => (
              <line
                data-axis="y"
                data-part="line"
                data-zero={tick.value === 0 || undefined}
                key={`y-${tick.value}`}
                style={NON_SCALING}
                x1={0}
                x2={1}
                y1={1 - tick.position}
                y2={1 - tick.position}
              />
            ))}
          </svg>
          {columns.map((tick) =>
            tick.label === null ? null : (
              <div
                data-axis="x"
                data-part="label"
                key={`x-${tick.value}`}
                style={{
                  left: `${tick.position * 100}%`,
                  position: "absolute",
                }}
              >
                {tick.label}
              </div>
            )
          )}
          {rows.map((tick) =>
            tick.label === null ? null : (
              <div
                data-axis="y"
                data-part="label"
                key={`y-${tick.value}`}
                style={{
                  position: "absolute",
                  top: `${(1 - tick.position) * 100}%`,
                }}
              >
                {tick.label}
              </div>
            )
          )}
        </>
      )}
    </parts.Grid>
  );
}

type HandleProps = ComponentProps<typeof parts.Handle> & {
  /** Names each axis input. Defaults to `aria-label`, followed by "X" or "Y" when the handle moves along both. */
  getAriaLabel?: (axis: "x" | "y") => string | undefined;
  /** Returns an axis input's `aria-valuetext`, from its value. */
  getAriaValueText?: (value: number, axis: "x" | "y") => string;
};

const childrenOf = (
  children: HandleProps["children"],
  state: HandleState
): ReactNode => (typeof children === "function" ? children(state) : children);

/**
 * A point on the plot that can be moved, in the axes' units, with a native
 * `<input type="range">` for each axis it moves along carrying the names.
 */
function Handle({
  "aria-label": label,
  axis = "both",
  children,
  getAriaLabel,
  getAriaValueText,
  handle,
  ...props
}: HandleProps) {
  const nameOf = useCallback(
    (along: "x" | "y") =>
      getAriaLabel?.(along) ??
      (label && axis === "both" ? `${label} ${along.toUpperCase()}` : label),
    [axis, getAriaLabel, label]
  );
  return (
    <parts.Handle {...props} axis={axis} handle={handle}>
      {(state) => (
        <>
          {childrenOf(children, state)}
          {axis === "y" ? null : (
            <parts.InputX
              getAriaLabel={nameOf}
              getAriaValueText={getAriaValueText}
              handle={handle}
            />
          )}
          {axis === "x" ? null : (
            <parts.InputY
              getAriaLabel={nameOf}
              getAriaValueText={getAriaValueText}
              handle={handle}
            />
          )}
        </>
      )}
    </parts.Handle>
  );
}

export const Plot = {
  Band,
  Curve,
  Cursor: parts.Cursor,
  CursorReadout: parts.CursorReadout,
  Dot: parts.Dot,
  Grid,
  Handle,
  Line,
  Mark: parts.Mark,
  Root: parts.Root,
  Trace,
};
