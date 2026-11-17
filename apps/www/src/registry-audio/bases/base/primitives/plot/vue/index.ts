import { createParts } from "@ui-sdk/vue/primitive";
import { defineComponent, h } from "vue";
import {
  type BandState,
  type GridState,
  type HandleState,
  type LineState,
  type PathState,
  plot,
} from "@/primitives/plot";

/** Which element each part is. */
const parts = createParts(plot, {
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
});

/** A path that keeps its width however the plot is stretched. */
const NON_SCALING = { vectorEffect: "non-scaling-stroke" };

/** A part that draws one path: an `<svg>` over the plot, its path written as the child. */
const pathPart = (part: typeof parts.Curve, name: string) =>
  defineComponent(
    (_props, { attrs }) =>
      () =>
        h(part, attrs as never, {
          default: ({ state }: { state: PathState }) =>
            h("path", { d: state.d, "data-plot": "path", style: NON_SCALING }),
        }),
    { inheritAttrs: false, name }
  );

/** A curve across the plot: `y = fn(x)` in the axes' units. Style its `stroke` and `fill`. */
const Curve = pathPart(parts.Curve, "PlotCurve");

/** A live line across the plot, drawn straight in the DOM from a source. Style its `stroke` and `fill`. */
const Trace = pathPart(parts.Trace as never, "PlotTrace");

/** A straight line across the plot at a value. Style its `stroke`. */
const Line = defineComponent(
  (_props, { attrs }) =>
    () =>
      h(parts.Line, attrs as never, {
        default: ({ state }: { state: LineState }) =>
          h("line", {
            style: NON_SCALING,
            x1: state.x1,
            x2: state.x2,
            y1: state.y1,
            y2: state.y2,
          }),
      }),
  { inheritAttrs: false, name: "PlotLine" }
);

/** A stretch of the plot between two values on one axis. Style its `fill`. */
const Band = defineComponent(
  (_props, { attrs }) =>
    () =>
      h(parts.Band, attrs as never, {
        default: ({ state }: { state: BandState }) =>
          h("rect", {
            height: state.height,
            width: state.width,
            x: state.x,
            y: state.y,
          }),
      }),
  { inheritAttrs: false, name: "PlotBand" }
);

/** Grid lines and their labels: `data-part="line"` and `data-part="label"`, each with `data-axis`. */
const Grid = defineComponent(
  (_props, { attrs }) =>
    () =>
      h(parts.Grid, attrs as never, {
        default: ({ state }: { state: GridState }) => [
          h(
            "svg",
            {
              "aria-hidden": "true",
              height: "100%",
              preserveAspectRatio: "none",
              style: { inset: 0, overflow: "visible", position: "absolute" },
              viewBox: "0 0 1 1",
              width: "100%",
            },
            [
              ...state.columns.map((tick) =>
                h("line", {
                  "data-axis": "x",
                  "data-part": "line",
                  "data-zero": tick.value === 0 ? "" : undefined,
                  key: `x-${tick.value}`,
                  style: NON_SCALING,
                  x1: tick.position,
                  x2: tick.position,
                  y1: 0,
                  y2: 1,
                })
              ),
              ...state.rows.map((tick) =>
                h("line", {
                  "data-axis": "y",
                  "data-part": "line",
                  "data-zero": tick.value === 0 ? "" : undefined,
                  key: `y-${tick.value}`,
                  style: NON_SCALING,
                  x1: 0,
                  x2: 1,
                  y1: 1 - tick.position,
                  y2: 1 - tick.position,
                })
              ),
            ]
          ),
          ...state.columns
            .filter((tick) => tick.label !== null)
            .map((tick) =>
              h(
                "div",
                {
                  "data-axis": "x",
                  "data-part": "label",
                  key: `x-${tick.value}`,
                  style: {
                    left: `${tick.position * 100}%`,
                    position: "absolute",
                  },
                },
                tick.label ?? ""
              )
            ),
          ...state.rows
            .filter((tick) => tick.label !== null)
            .map((tick) =>
              h(
                "div",
                {
                  "data-axis": "y",
                  "data-part": "label",
                  key: `y-${tick.value}`,
                  style: {
                    position: "absolute",
                    top: `${(1 - tick.position) * 100}%`,
                  },
                },
                tick.label ?? ""
              )
            ),
        ],
      }),
  { inheritAttrs: false, name: "PlotGrid" }
);

/**
 * A point on the plot that can be moved, in the axes' units, with a native
 * `<input type="range">` for each axis it moves along carrying the names.
 */
const Handle = defineComponent(
  (
    props: {
      axis?: "both" | "x" | "y";
      getAriaLabel?: (axis: "x" | "y") => string | undefined;
      getAriaValueText?: (value: number, axis: "x" | "y") => string;
      handle: string;
    },
    { attrs, slots }
  ) =>
    () => {
      const { "aria-label": label, ...rest } = attrs;
      const axis = props.axis ?? "both";
      const nameOf = (along: "x" | "y") =>
        props.getAriaLabel?.(along) ??
        (label && axis === "both"
          ? `${label} ${along.toUpperCase()}`
          : (label as string | undefined));
      const input = (along: "x" | "y") =>
        h(along === "x" ? parts.InputX : parts.InputY, {
          getAriaLabel: nameOf,
          getAriaValueText: props.getAriaValueText,
          handle: props.handle,
        });
      return h(
        parts.Handle,
        { ...rest, axis, handle: props.handle },
        {
          default: (scope: { state: HandleState }) => [
            slots.default?.(scope),
            axis === "y" ? null : input("x"),
            axis === "x" ? null : input("y"),
          ],
        }
      );
    },
  {
    inheritAttrs: false,
    name: "PlotHandle",
    props: ["axis", "getAriaLabel", "getAriaValueText", "handle"],
  }
);

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
