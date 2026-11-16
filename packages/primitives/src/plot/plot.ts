import {
  createSource,
  type ParameterScaleProp,
  resolveScale,
  type Source,
  type WritableSource,
} from "@audio-ui/core";
import {
  axisTicks,
  createPlotHandleController,
  curvePath,
  formatTick,
  type PlotAxis,
  type PlotHandleAxis,
  type PlotHandleController,
  type PlotHandleOptions,
  type PlotPoint,
  positionOn,
  tracePath,
  valueOn,
} from "@audio-ui/core/plot";
import {
  css,
  definePrimitive,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { flag, noop, sourceOf, VISUALLY_HIDDEN } from "../shared.ts";

/**
 * The plot as a UI SDK primitive: a surface with two axes (a range and a scale
 * each, linear or logarithmic) on which curves, lines, bands, traces, dots,
 * marks, a grid and draggable handles are placed in the axes' units.
 *
 * Every part that draws is an `<svg>` of its own stretched over the plot (a
 * custom element cannot sit inside an `<svg>`): it exposes the path it draws in
 * its public state, and each framework writes it as the child. A live `source`
 * is painted straight onto that child, with no render.
 *
 * A handle is keyed by its `handle` name and holds a controller of its own.
 * What it reports goes through the Root, `onValueChange` and
 * `onValueCommitted`, with the handle's name in the details.
 */

export interface PlotPrimitiveOptions {
  /** @default false */
  disabled?: boolean;
  /** @default 1 */
  maxX?: number;
  /** @default 1 */
  maxY?: number;
  /** @default 0 */
  minX?: number;
  /** @default 0 */
  minY?: number;
  /** A handle moved: its name is `details.handle`. `details.cancel()` refuses it. */
  onValueChange?: (value: PlotPoint, details: HandleChangeDetails) => void;
  /** A handle's gesture ended, or a key or input moved it. */
  onValueCommitted?: (value: PlotPoint, details: HandleCommitDetails) => void;
  /** How x values spread across: `"log"` for frequency, or your own `{ toPosition, toValue }`. @default "linear" */
  scaleX?: ParameterScaleProp;
  /** How y values spread up. @default "linear" */
  scaleY?: ParameterScaleProp;
}

/** What a handle's change reports. */
export interface HandleChangeDetails {
  cancel: () => void;
  event?: Event;
  /** The name of the handle that moved. */
  handle: string;
  reason: string;
  source?: string;
}

/** What a handle's commit reports. */
export interface HandleCommitDetails {
  event?: Event;
  handle: string;
  reason: string;
}

export interface PlotState {
  axes: { x: PlotAxis; y: PlotAxis };
  disabled: boolean;
  /** Counts the changes a handle's controller made, so the parts read them again. */
  version: number;
}

/** What a part reads of the plot. */
export interface PlotPublicState {
  disabled: boolean;
}

/** A tick of a grid. */
export interface GridTick {
  label: string | null;
  /** 0 to 1 along the axis. */
  position: number;
  value: number;
}

/** What a grid draws along one axis. */
export interface GridAxis {
  /** About how many ticks to draw when they are not given. @default 5 */
  count?: number;
  /** Text for a tick's label. Defaults to a short number such as "1k". */
  format?: (value: number) => string;
  /** Whether the labels are written. @default true */
  labels?: boolean;
  /** Where the lines go. Without it, round values spread evenly over the axis. */
  ticks?: readonly number[];
}

/** What the grid draws. */
export interface GridState extends PlotPublicState {
  columns: GridTick[];
  rows: GridTick[];
}

/** What a part that draws a path reads: the path, in a 1 by 1 box with y going up. */
export interface PathState extends PlotPublicState {
  d: string;
}

/** What a line reads: its two ends, in the 1 by 1 box. */
export interface LineState extends PlotPublicState {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** What a band reads: its box, in the 1 by 1 box. */
export interface BandState extends PlotPublicState {
  height: number;
  width: number;
  x: number;
  y: number;
}

/** What a handle reads of itself. */
export interface HandleState extends PlotPublicState {
  axis: PlotHandleAxis;
  /** Whether a pointer is dragging it. */
  dragging: boolean;
}

/** What a plot's `api` gives an adapter. */
export interface PlotApi {
  /** The controller of the handle named in `props`, with the latest props and axes. */
  controllerFor: (
    state: PlotState,
    props: HandleProps | HandleInputProps
  ) => PlotHandleController;
  /** The latest value under the pointer, for a cursor readout. */
  cursor: WritableSource<PlotPoint | null>;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (handle: unknown) => string };
  /** The plot's box in the viewport; `fresh` reads it again, for the start of a gesture. */
  measure: (fresh?: boolean) => DOMRect | null;
  /** The plot's element and what forgets its box, once it binds. */
  root: { el: HTMLElement | undefined; forget: () => void };
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a handle. */
export interface HandleProps extends PartProps {
  /** The axes it moves along; the other keeps the value given. @default "both" */
  axis?: PlotHandleAxis;
  defaultValue?: PlotPoint;
  disabled?: boolean;
  /** The name of the handle: what keys it and what its changes report. */
  handle: string;
  value?: PlotPoint;
}

/** The props of a handle's input for one axis. */
export interface HandleInputProps extends PartProps {
  /** Names the input. Defaults to the handle's `aria-label`, then "X" or "Y". */
  getAriaLabel?: (axis: "x" | "y") => string | undefined;
  /** Returns the input's `aria-valuetext`, from its value. */
  getAriaValueText?: (value: number, axis: "x" | "y") => string;
  handle: string;
}

/** The plot's slots, by name, with the props and the public state of each. */
export type PlotSlots = {
  band: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & { axis: "x" | "y"; from: number; to: number },
    BandState
  >;
  curve: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & {
      fillTo?: number;
      fn: (x: number) => number;
      samples?: number;
    },
    PathState
  >;
  cursor: SlotDefinition<PlotState, PlotApi, PartProps, PlotPublicState>;
  cursorReadout: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & { format: (value: PlotPoint) => string },
    object
  >;
  dot: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & { source?: Source<PlotPoint>; value?: PlotPoint },
    PlotPublicState
  >;
  grid: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & { x?: GridAxis; y?: GridAxis },
    GridState
  >;
  handle: SlotDefinition<PlotState, PlotApi, HandleProps, HandleState>;
  inputX: SlotDefinition<PlotState, PlotApi, HandleInputProps, object>;
  inputY: SlotDefinition<PlotState, PlotApi, HandleInputProps, object>;
  line: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & { axis: "x" | "y"; value: number },
    LineState
  >;
  mark: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & { axis: "x" | "y"; value: number },
    PlotPublicState & { axis: "x" | "y" }
  >;
  root: SlotDefinition<PlotState, PlotApi, PartProps, PlotPublicState>;
  trace: SlotDefinition<
    PlotState,
    PlotApi,
    PartProps & {
      fillTo?: number;
      max?: number;
      min?: number;
      source: Source<ArrayLike<number>>;
    },
    PathState
  >;
};

/**
 * The type of `plot`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface PlotPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: PlotSlots;
  (
    initialOptions: PlotPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: PlotApi;
    get: () => PlotState;
    types: {
      api: PlotApi;
      options: PlotPrimitiveOptions;
      slots: PlotSlots;
      state: PlotState;
    };
  };
}

const axesOf = (options: PlotPrimitiveOptions) => ({
  x: {
    max: options.maxX ?? 1,
    min: options.minX ?? 0,
    scale: resolveScale(options.scaleX ?? "linear"),
  },
  y: {
    max: options.maxY ?? 1,
    min: options.minY ?? 0,
    scale: resolveScale(options.scaleY ?? "linear"),
  },
});

const stateOf = (options: PlotPrimitiveOptions): PlotState => ({
  axes: axesOf(options),
  disabled: options.disabled ?? false,
  version: 0,
});

const publicState = (state: PlotState): PlotPublicState => ({
  disabled: state.disabled,
});

const round = (value: number) => Math.round(value * 1e5) / 1e5;

/** Gives each function that reaches a curve an id, so a part that gets a new one is written again. */
const fnIds = new WeakMap<object, number>();
let nextFnId = 0;
const fnId = (value: unknown) => {
  if (
    value === null ||
    (typeof value !== "function" && typeof value !== "object")
  ) {
    return "0";
  }
  let id = fnIds.get(value);
  if (id === undefined) {
    nextFnId += 1;
    id = nextFnId;
    fnIds.set(value, id);
  }
  return String(id);
};

/** The box every drawing part is: an `<svg>` stretched over the plot, hidden from the pointer. */
const drawingAttrs = (state: PlotState) => ({
  "aria-hidden": "true",
  "data-disabled": flag(state.disabled),
  preserveAspectRatio: "none",
  style: css({
    height: "100%",
    inset: "0",
    overflow: "visible",
    "pointer-events": "none",
    position: "absolute",
    width: "100%",
  }),
  viewBox: "0 0 1 1",
});

const percent = (value: number) =>
  `${(Number.isNaN(value) ? 0 : value) * 100}%`;

/** The path the framework wrote as the child of a drawing part: marked by the adapter. */
const PATH = 'path[data-plot="path"]';

/** Writes a path onto the child the framework made, if it is there yet. */
function paintPath(el: HTMLElement, d: string) {
  const path = el.querySelector(PATH);
  if (path && path.getAttribute("d") !== d) {
    path.setAttribute("d", d);
  }
}

const placement = (point: PlotPoint, axes: PlotState["axes"]) => ({
  left: percent(positionOn(axes.x, point.x)),
  top: percent(1 - positionOn(axes.y, point.y)),
});

export const lineOf = (
  axes: PlotState["axes"],
  axis: "x" | "y",
  value: number
): Omit<LineState, "disabled"> => {
  const at =
    axis === "x" ? positionOn(axes.x, value) : 1 - positionOn(axes.y, value);
  return axis === "x"
    ? { x1: at, x2: at, y1: 0, y2: 1 }
    : { x1: 0, x2: 1, y1: at, y2: at };
};

export const bandOf = (
  axes: PlotState["axes"],
  axis: "x" | "y",
  from: number,
  to: number
): Omit<BandState, "disabled"> => {
  const along = axis === "x" ? axes.x : axes.y;
  const start = round(positionOn(along, Math.min(from, to)));
  const end = round(positionOn(along, Math.max(from, to)));
  return axis === "x"
    ? { height: 1, width: round(end - start), x: start, y: 0 }
    : { height: round(end - start), width: 1, x: 0, y: round(1 - end) };
};

export const ticksOf = (
  axis: PlotAxis,
  options: GridAxis | undefined
): GridTick[] => {
  if (!options) {
    return [];
  }
  const values = options.ticks ?? axisTicks(axis, options.count);
  return values.map((value) => ({
    label:
      options.labels === false ? null : (options.format ?? formatTick)(value),
    position: positionOn(axis, value),
    value,
  }));
};

/** The axes a handle moves along, as the controller wants them. */
const handleAxis = (props: HandleProps | HandleInputProps) =>
  "axis" in props ? props.axis : undefined;

/** The path of a curve, in the 1 by 1 box with y going up: what a `curve` part draws. */
export const curveOf = (
  axes: PlotState["axes"],
  fn: (x: number) => number,
  samples?: number,
  fillTo?: number
) => curvePath(fn, axes.x, axes.y, samples ?? 256, fillTo);

/** The path of a trace of `values`: what a `trace` part draws. */
export const traceOf = (
  axes: PlotState["axes"],
  values: ArrayLike<number>,
  scale: { fillTo?: number; max?: number; min?: number } = {}
) =>
  tracePath(
    values,
    {
      max: scale.max ?? axes.y.max,
      min: scale.min ?? axes.y.min,
      scale: axes.y.scale,
    },
    scale.fillTo
  );

export const plot: PlotPrimitive = definePrimitive({
  api: (context) => {
    const handles = new Map<string, PlotHandleController>();
    const root: PlotApi["root"] = { el: undefined, forget: noop };
    let rect: DOMRect | null = null;
    root.forget = () => {
      rect = null;
    };
    return {
      controllerFor: (
        state: PlotState,
        props: HandleProps | HandleInputProps
      ) => {
        const name = String(props.handle);
        const wanted = props as HandleProps;
        const options: PlotHandleOptions = {
          axis: handleAxis(props),
          defaultValue: wanted.defaultValue,
          disabled: state.disabled || Boolean(wanted.disabled),
          measure: (fresh) => rect_(fresh),
          onValueChange: (value, details) => {
            const source = sourceOf(details.event);
            const canceled = dispatch(context, "onValueChange", value, {
              event: details.event,
              handle: name,
              reason: details.reason,
              ...(source ? { source } : {}),
            });
            if (canceled) {
              details.cancel();
            }
          },
          onValueCommitted: (value, details) => {
            dispatch(context, "onValueCommitted", value, {
              event: details.event,
              handle: name,
              reason: details.reason,
            });
          },
          value: wanted.value,
          x: state.axes.x,
          y: state.axes.y,
        };
        let controller = handles.get(name);
        if (controller) {
          // A handle is told the props of its newest render, as the React one is.
          if ("value" in props || "axis" in props) {
            controller.setOptions(options);
          }
        } else {
          controller = createPlotHandleController(options);
          controller.subscribe(() =>
            context.store.set({ version: context.store.get().version + 1 })
          );
          handles.set(name, controller);
        }
        return controller;
      },
      cursor: createSource<PlotPoint | null>(null),
      internal: { keyOf: (handle: unknown) => String(handle) },
      measure: rect_,
      root,
    };
    function rect_(fresh = false) {
      if (fresh || !rect) {
        const box = root.el?.getBoundingClientRect();
        rect = box && box.width > 0 && box.height > 0 ? box : null;
      }
      return rect;
    }
  },
  name: "plot",
  options: {
    disabled: "boolean",
    maxX: "number",
    maxY: "number",
    minX: "number",
    minY: "number",
    onValueChange: "callback",
    onValueCommitted: "callback",
    scaleX: "value",
    scaleY: "value",
  },
  slots: (slot) => {
    const handleInput = (along: "x" | "y") =>
      slot<HandleInputProps>({
        attrs: (state: PlotState, { api, props }) => {
          const view = api.controllerFor(state, props).getSnapshot();
          const current = view.value[along];
          return {
            "aria-label": props.getAriaLabel?.(along),
            "aria-orientation": along === "x" ? "horizontal" : "vertical",
            "aria-valuetext": props.getAriaValueText
              ? props.getAriaValueText(current, along)
              : String(Math.round(current * 100) / 100),
            disabled: flag(view.disabled),
            max: "1",
            min: "0",
            step: "any",
            style: css(VISUALLY_HIDDEN),
            // Only the first input is in the tab order.
            tabindex: along === "x" || view.axis === "y" ? undefined : "-1",
            type: "range",
            value: String(view.position[along]),
          };
        },
        on: {
          change: (event, { api, el, props, store }) =>
            api
              .controllerFor(store.get(), props)
              .typeAt(along, Number((el as HTMLInputElement).value), event),
          keydown: (event, { api, props, store }) => {
            if (api.controllerFor(store.get(), props).keyDown(event)) {
              event.preventDefault();
            }
          },
        },
        props: {
          getAriaLabel: "value",
          getAriaValueText: "value",
          handle: "key",
        },
      });

    return {
      band: slot<{ axis: "x" | "y"; from: number; to: number }, BandState>({
        attrs: drawingAttrs,
        props: { axis: "string", from: "number", to: "number" },
        state: (state: PlotState, { props }) => ({
          ...publicState(state),
          ...bandOf(state.axes, props.axis, props.from, props.to),
        }),
      }),
      curve: slot<
        { fillTo?: number; fn: (x: number) => number; samples?: number },
        PathState
      >({
        attrs: (state: PlotState, { props }) => ({
          ...drawingAttrs(state),
          "data-fn": fnId(props.fn),
        }),
        props: { fillTo: "number", fn: "value", samples: "number" },
        state: (state: PlotState, { props }) => ({
          ...publicState(state),
          d: props.fn
            ? curvePath(
                props.fn,
                state.axes.x,
                state.axes.y,
                props.samples ?? 256,
                props.fillTo
              )
            : "",
        }),
      }),
      cursor: slot<object, PlotPublicState>({
        attrs: (state: PlotState) => ({
          "aria-hidden": "true",
          "data-disabled": flag(state.disabled),
          style: css({
            inset: "0",
            "pointer-events": "none",
            position: "absolute",
          }),
        }),
        // Follows the pointer over the plot, in the DOM: no render for a pointer that moves.
        bind: (el, part) => {
          // A child binds before its parent has set `root.el` or its attributes, in React and Vue: look for the plot once the parents have.
          let detach: () => void = () => undefined;
          let disposed = false;
          queueMicrotask(() => {
            const plotEl = part.api.root.el ?? el.parentElement;
            if (disposed || !plotEl) {
              return;
            }
            detach = listen(plotEl);
          });
          const listen = (plotEl: HTMLElement) => {
            const handleMove = (event: PointerEvent) => {
              if (event.pointerType === "touch") {
                return;
              }
              const rect = part.api.measure();
              if (!rect) {
                return;
              }
              const { axes } = part.store.get();
              const across = Math.min(
                1,
                Math.max(0, (event.clientX - rect.left) / rect.width)
              );
              const down = Math.min(
                1,
                Math.max(0, (event.clientY - rect.top) / rect.height)
              );
              el.style.setProperty("--plot-cursor-x", `${across * 100}%`);
              el.style.setProperty("--plot-cursor-y", `${down * 100}%`);
              el.setAttribute("data-active", "");
              part.api.cursor.set({
                x: valueOn(axes.x, across),
                y: valueOn(axes.y, 1 - down),
              });
            };
            const handleEnter = () => part.api.measure(true);
            const handleLeave = () => {
              el.removeAttribute("data-active");
              part.api.cursor.set(null);
            };
            plotEl.addEventListener("pointerenter", handleEnter);
            plotEl.addEventListener("pointermove", handleMove);
            plotEl.addEventListener("pointerleave", handleLeave);
            return () => {
              plotEl.removeEventListener("pointerenter", handleEnter);
              plotEl.removeEventListener("pointermove", handleMove);
              plotEl.removeEventListener("pointerleave", handleLeave);
            };
          };
          return () => {
            disposed = true;
            detach();
          };
        },
        state: (state: PlotState) => publicState(state),
      }),
      cursorReadout: slot<{ format: (value: PlotPoint) => string }>({
        attrs: (state: PlotState) => ({
          "data-disabled": flag(state.disabled),
          style: css({
            left: "var(--plot-cursor-x)",
            position: "absolute",
            top: "var(--plot-cursor-y)",
          }),
        }),
        // One text node, rewritten in place as the pointer moves.
        bind: (el, part) => {
          const text = el.appendChild(document.createTextNode(""));
          const paint = () => {
            const value = part.api.cursor.getSnapshot();
            text.data = value ? part.props.format(value) : "";
          };
          paint();
          const off = part.api.cursor.subscribe(paint);
          return () => {
            off();
            text.remove();
          };
        },
        props: { format: "value" },
      }),
      dot: slot<
        { source?: Source<PlotPoint>; value?: PlotPoint },
        PlotPublicState
      >({
        attrs: (state: PlotState, { props }) => {
          const point = props.source?.getSnapshot() ??
            props.value ?? { x: state.axes.x.min, y: state.axes.y.min };
          return {
            "aria-hidden": "true",
            "data-disabled": flag(state.disabled),
            style: css({
              ...placement(point, state.axes),
              "pointer-events": "none",
              position: "absolute",
              translate: "-50% -50%",
            }),
          };
        },
        // A live point moves in the DOM, with no render.
        bind: (el, part) => {
          const { source } = part.props;
          if (!source) {
            return;
          }
          const paint = () => {
            const next = placement(source.getSnapshot(), part.store.get().axes);
            el.style.left = next.left;
            el.style.top = next.top;
          };
          paint();
          return source.subscribe(paint);
        },
        props: { source: "value", value: "value" },
        state: (state: PlotState) => publicState(state),
      }),
      grid: slot<{ x?: GridAxis; y?: GridAxis }, GridState>({
        attrs: (state: PlotState, { props }) => ({
          "aria-hidden": "true",
          "data-disabled": flag(state.disabled),
          // Changes when the ticks are given anew, so a part draws them again.
          "data-ticks": `${fnId(props.x)}.${fnId(props.y)}`,
          style: css({
            inset: "0",
            "pointer-events": "none",
            position: "absolute",
          }),
        }),
        props: { x: "value", y: "value" },
        state: (state: PlotState, { props }) => ({
          ...publicState(state),
          columns: ticksOf(state.axes.x, props.x),
          rows: ticksOf(state.axes.y, props.y),
        }),
      }),
      handle: slot<HandleProps, HandleState>({
        attrs: (state: PlotState, { api, props }) => {
          const view = api.controllerFor(state, props).getSnapshot();
          return {
            "data-axis": view.axis,
            "data-disabled": flag(view.disabled),
            "data-dragging": flag(view.dragging),
            "data-handle": String(props.handle),
            style: css({
              left: `${view.position.x * 100}%`,
              position: "absolute",
              top: `${(1 - view.position.y) * 100}%`,
              "touch-action": "none",
              translate: "-50% -50%",
            }),
          };
        },
        on: {
          // A double click, or Alt with a press, brings the handle back to its default.
          dblclick: (event, { api, props, store }) => {
            const controller = api.controllerFor(store.get(), props);
            if (!controller.getSnapshot().disabled) {
              controller.reset(event);
            }
          },
          pointerdown: (event, { api, el, props, store }) => {
            const controller = api.controllerFor(store.get(), props);
            if (
              !el ||
              event.button !== 0 ||
              controller.getSnapshot().disabled
            ) {
              return;
            }
            event.preventDefault();
            if (!event.altKey) {
              el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
                preventScroll: true,
              });
            }
            controller.press(event, el);
          },
        },
        props: {
          axis: "string",
          defaultValue: "value",
          disabled: "boolean",
          handle: "key",
          value: "value",
        },
        state: (state: PlotState, { api, props }) => {
          const view = api.controllerFor(state, props).getSnapshot();
          return {
            axis: view.axis,
            disabled: view.disabled,
            dragging: view.dragging,
          };
        },
      }),
      inputX: handleInput("x"),
      inputY: handleInput("y"),
      line: slot<{ axis: "x" | "y"; value: number }, LineState>({
        attrs: drawingAttrs,
        props: { axis: "string", value: "number" },
        state: (state: PlotState, { props }) => ({
          ...publicState(state),
          ...lineOf(state.axes, props.axis, props.value),
        }),
      }),
      mark: slot<
        { axis: "x" | "y"; value: number },
        PlotPublicState & { axis: "x" | "y" }
      >({
        attrs: (state: PlotState, { props }) => ({
          "aria-hidden": "true",
          "data-axis": props.axis,
          "data-disabled": flag(state.disabled),
          style: css({
            ...(props.axis === "x"
              ? { left: percent(positionOn(state.axes.x, props.value)) }
              : { top: percent(1 - positionOn(state.axes.y, props.value)) }),
            "pointer-events": "none",
            position: "absolute",
          }),
        }),
        props: { axis: "string", value: "number" },
        state: (state: PlotState, { props }) => ({
          ...publicState(state),
          axis: props.axis,
        }),
      }),
      root: slot<object, PlotPublicState>({
        attrs: (state: PlotState) => ({
          "data-disabled": flag(state.disabled),
          // Layout containment: what moves inside the plot never makes the page around it lay out again.
          style: css({ contain: "layout style", position: "relative" }),
        }),
        bind: (el, part) => {
          part.api.root.el = el;
          const forget = () => part.api.root.forget();
          const observer =
            typeof ResizeObserver === "undefined"
              ? null
              : new ResizeObserver(forget);
          observer?.observe(el);
          window.addEventListener("scroll", forget, {
            capture: true,
            passive: true,
          });
          window.addEventListener("resize", forget, { passive: true });
          return () => {
            observer?.disconnect();
            window.removeEventListener("scroll", forget, { capture: true });
            window.removeEventListener("resize", forget);
            part.api.root.el = undefined;
          };
        },
        state: (state: PlotState) => publicState(state),
      }),
      trace: slot<
        {
          fillTo?: number;
          max?: number;
          min?: number;
          source: Source<ArrayLike<number>>;
        },
        PathState
      >({
        attrs: drawingAttrs,
        // A live trace is drawn straight onto its path, frame by frame.
        bind: (el, part) => {
          const { source } = part.props;
          if (!source) {
            return;
          }
          const paint = () => {
            const { axes } = part.store.get();
            const y = {
              max: part.props.max ?? axes.y.max,
              min: part.props.min ?? axes.y.min,
              scale: axes.y.scale,
            };
            paintPath(
              el,
              tracePath(source.getSnapshot(), y, part.props.fillTo)
            );
          };
          paint();
          return source.subscribe(paint);
        },
        props: {
          fillTo: "number",
          max: "number",
          min: "number",
          source: "value",
        },
        state: (state: PlotState, { props }) => ({
          ...publicState(state),
          d: props.source
            ? tracePath(
                props.source.getSnapshot(),
                {
                  max: props.max ?? state.axes.y.max,
                  min: props.min ?? state.axes.y.min,
                  scale: state.axes.y.scale,
                },
                props.fillTo
              )
            : "",
        }),
      }),
    };
  },
  state: stateOf,
  sync: (options: PlotPrimitiveOptions) => {
    const { version: _version, ...held } = stateOf(options);
    return held;
  },
});
