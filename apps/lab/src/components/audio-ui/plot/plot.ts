import {
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import {
  clamp,
  fractionOf,
  type NumberScale,
  valueAt,
} from "@ui-sdk/core/number";
import {
  adaptiveSamples,
  createGestures,
  definePrimitive,
  flag,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../primitive";

/**
 * The plot: a surface with two axes (a range and a scale each, linear or
 * logarithmic) on which curves, lines, bands, traces, dots, marks, a grid and
 * draggable handles are placed in the axes' units.
 *
 * Every part that draws is an `<svg>` of its own stretched over the plot (a
 * custom element cannot sit inside an `<svg>`): it exposes the path it draws in
 * its public state, and each framework writes it as the child. A live `source`
 * is painted straight onto that child, with no render.
 *
 * A handle is keyed by its `handle` name and holds a value of its own. What it
 * reports goes through the Root, `onValueChange` and `onValueCommitted`, with
 * the handle's name in the details.
 */

/** A point on the plot, in the axes' units. */
export interface PlotPoint {
  x: number;
  y: number;
}

/** The axes a handle moves along; the other keeps its value. */
export type PlotHandleAxis = "both" | "x" | "y";

/** A live value an engine pushes to: what it holds now, and a way to hear it change. */
export interface PlotSource<Value> {
  getSnapshot: () => Value;
  subscribe: (listener: () => void) => () => void;
}

/** One of the plot's two axes: its range and how values spread along it. */
export interface PlotAxis {
  max: number;
  min: number;
  scale: NumberScale;
}

/** A logarithmic axis needs a positive `min`; below that it spreads values evenly. */
const scaleOf = (axis: PlotAxis): NumberScale =>
  axis.scale === "log" && !(axis.min > 0 && axis.max > axis.min)
    ? "linear"
    : axis.scale;

/** Where `value` sits along `axis`, 0 at its `min` to 1 at its `max`. */
export const positionOn = (axis: PlotAxis, value: number) =>
  fractionOf(value, axis, scaleOf(axis));

/** The value at `position` (0 to 1) along `axis`. */
export const valueOn = (axis: PlotAxis, position: number) =>
  valueAt(position, axis, scaleOf(axis));

/** How far a drawn curve may stray from the function, as a share of the plot's height. */
const TOLERANCE = 0.0005;
/** How many ticks an axis gets unless asked for another number. */
const DEFAULT_TICK_COUNT = 5;
/** Candidates for a step's leading digit, in powers of ten. */
const STEP_MULTIPLES = [1, 2, 5, 10];
/** What an arrow key moves a handle by, as a share of the axis; Shift and Page Up/Down move ten times as far. */
const KEY_STEP = 0.01;
const LARGE_KEY_STEP = 0.1;
/** Shift slows a drag down to this share of the pointer's travel. */
const FINE_DRAG = 0.25;

const round = (value: number) => Math.round(value * 1e5) / 1e5;

/** The end of a path that closes down (or up) to `fillTo`, for a filled area. */
const closed = (path: string, y: PlotAxis, fillTo: number | undefined) => {
  if (fillTo === undefined) {
    return path;
  }
  const base = round(1 - positionOn(y, fillTo));
  return `${path} L 1 ${base} L 0 ${base} Z`;
};

/**
 * An SVG path drawing `y = fn(x)` across the whole x axis, in a 1 by 1 box
 * with y going up. Samples are spread evenly along the axis as drawn, so a
 * logarithmic axis gets as many per octave at the bottom as at the top, and
 * more are added where the curve bends tighter than that grid shows.
 */
function curvePath(
  fn: (x: number) => number,
  x: PlotAxis,
  y: PlotAxis,
  samples: number,
  fillTo?: number
) {
  const count = Math.max(2, Math.round(samples));
  const grid = Array.from({ length: count }, (_, index) => index / (count - 1));
  const height = (along: number) => {
    const value = fn(valueOn(x, along));
    return Number.isFinite(value) ? positionOn(y, value) : 0;
  };
  const points = adaptiveSamples(height, grid, TOLERANCE).map(
    ([along, up]) => `${round(along)} ${round(1 - up)}`
  );
  return closed(`M ${points.join(" L ")}`, y, fillTo);
}

/**
 * An SVG path through `values` spread evenly across the whole x axis, in the
 * same box: a spectrum, a level history. A value that is not a number sits on
 * the floor of the axis.
 */
function tracePath(values: ArrayLike<number>, y: PlotAxis, fillTo?: number) {
  if (values.length === 0) {
    return "";
  }
  const last = Math.max(values.length - 1, 1);
  const points: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? Number.NaN;
    const height = Number.isNaN(value) ? 0 : positionOn(y, value);
    points.push(`${round(index / last)} ${round(1 - height)}`);
  }
  return closed(`M ${points.join(" L ")}`, y, fillTo);
}

/** Even steps over `min` to `max`, at 1, 2 or 5 times a power of ten, roughly `count` of them. */
function linearTicks(min: number, max: number, count: number) {
  const span = max - min;
  if (!(span > 0 && count > 0)) {
    return [];
  }
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    (STEP_MULTIPLES.find((multiple) => multiple * power >= raw) ?? 10) * power;
  const ticks: number[] = [];
  for (
    let value = Math.ceil(min / step) * step;
    value <= max + step * 1e-9;
    value += step
  ) {
    // Rounded to the step's own decimals, so 0.1 + 0.2 is 0.3.
    ticks.push(
      Number(value.toFixed(Math.max(0, -Math.floor(Math.log10(step)) + 1)))
    );
  }
  return ticks;
}

/** Ticks for a logarithmic axis: each power of ten, with its 2 and 5 when that still leaves room. */
function logTicks(min: number, max: number, count: number) {
  if (!(min > 0 && max > min)) {
    return [];
  }
  const decades = (multiples: readonly number[]) => {
    const ticks: number[] = [];
    for (
      let power = Math.floor(Math.log10(min));
      10 ** power <= max;
      power += 1
    ) {
      for (const multiple of multiples) {
        const value = multiple * 10 ** power;
        if (value >= min * (1 - 1e-9) && value <= max * (1 + 1e-9)) {
          ticks.push(value);
        }
      }
    }
    return ticks;
  };
  const fine = decades([1, 2, 5]);
  return fine.length <= count * 1.5 ? fine : decades([1]);
}

/** Round, evenly spread tick values for `axis`: by power of ten when it is logarithmic. */
const axisTicks = (axis: PlotAxis, count = DEFAULT_TICK_COUNT) =>
  axis.scale === "log"
    ? logTicks(axis.min, axis.max, count)
    : linearTicks(axis.min, axis.max, count);

const trim = (value: number) => String(Number(value.toFixed(2)));

/** A tick as short text: 1000 as "1k", 0.5 as "0.5", -12 as "-12". */
function formatTick(value: number) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) {
    return `${trim(value / 1_000_000)}M`;
  }
  if (magnitude >= 1000) {
    return `${trim(value / 1000)}k`;
  }
  return trim(value);
}

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
  /** How x values spread across: `"log"` for frequency, or a `{ to, from }` pair that maps values into an even space and back. @default "linear" */
  scaleX?: NumberScale;
  /** How y values spread up. @default "linear" */
  scaleY?: NumberScale;
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
  /** Counts the changes a handle made, so the parts read them again. */
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

/** What a view draws a handle from. */
export interface PlotHandleSnapshot {
  axis: PlotHandleAxis;
  disabled: boolean;
  dragging: boolean;
  /** Where the handle sits along each axis, 0 to 1. */
  position: PlotPoint;
  /** The value, clamped to both axes. */
  value: PlotPoint;
}

/** A live value the plot writes and its parts read: the value under the pointer. */
interface WritableSource<Value> extends PlotSource<Value> {
  set: (value: Value) => void;
}

/** What a plot's `api` gives an adapter. */
export interface PlotApi {
  /** The latest value under the pointer, for a cursor readout. */
  cursor: WritableSource<PlotPoint | null>;
  /** What the handle named in `props` shows, with the latest props and axes. */
  handleView: (
    state: PlotState,
    props: HandleProps | HandleInputProps
  ) => PlotHandleSnapshot;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (handle: unknown) => string };
  /** Handles a key on a handle's input: arrows move a hundredth of the axis, Shift or Page Up/Down a tenth, Delete or Backspace reset. Returns whether it took the key. */
  keyDown: (name: string, event: KeyboardEvent) => boolean;
  /** The plot's box in the viewport; `fresh` reads it again, for the start of a gesture. */
  measure: (fresh?: boolean) => DOMRect | null;
  /** Starts a drag of a handle from where it is (Shift makes it four times finer); an Alt press resets it. */
  press: (name: string, event: PointerEvent, element: HTMLElement) => void;
  /** Returns a handle to its default value, reporting a `"reset"` change and commit. */
  reset: (name: string, event: Event) => void;
  /** The plot's element and what forgets its box, once it binds. */
  root: { el: HTMLElement | undefined; forget: () => void };
  /** Moves a handle along one axis to a position, 0 to 1, from an input. */
  typeAt: (
    name: string,
    along: "x" | "y",
    position: number,
    event: Event
  ) => void;
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
    PartProps & { source?: PlotSource<PlotPoint>; value?: PlotPoint },
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
      source: PlotSource<ArrayLike<number>>;
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
    scale: options.scaleX ?? "linear",
  },
  y: {
    max: options.maxY ?? 1,
    min: options.minY ?? 0,
    scale: options.scaleY ?? "linear",
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

/** A line at `value` along one axis, across the whole other. */
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

/** A band from `from` to `to` along one axis, across the whole other. */
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

/** The ticks a grid draws along one axis. */
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

/** A source the plot writes itself. */
function createWritable<Value>(initial: Value): WritableSource<Value> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set: (next) => {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** One drag of a handle, from press to release. */
interface HandleGesture {
  changed: boolean;
  fine: boolean;
  /** Where the handle was, as positions along each axis, when the drag began or Shift last changed. */
  origin: PlotPoint;
  /** The plot's box when the press began: it does not move under a drag. */
  rect: DOMRect | null;
  start: { x: number; y: number };
  /** The last value the drag applied, which its end commits. */
  value: PlotPoint | null;
}

/** What the plot keeps of one handle. */
interface HandleRecord {
  dragging: boolean;
  gestures: ReturnType<typeof createGestures<HandleGesture>>;
  /** The value as the gesture under way left it: a controlled value that lags behind must not pull the handle back mid-drag. */
  latest: PlotPoint | null;
  /** The props of the handle's newest render. */
  props: HandleProps;
  /** Held by the handle, unless its `value` is given. */
  uncontrolled: PlotPoint | undefined;
}

export const plot: PlotPrimitive = definePrimitive({
  api: (context) => {
    const state = () => context.store.get() as PlotState;
    const records = new Map<string, HandleRecord>();
    const root: PlotApi["root"] = { el: undefined, forget: () => undefined };
    let rect: DOMRect | null = null;
    root.forget = () => {
      rect = null;
    };
    const measure = (fresh = false) => {
      if (fresh || !rect) {
        const box = root.el?.getBoundingClientRect();
        rect = box && box.width > 0 && box.height > 0 ? box : null;
      }
      return rect;
    };
    const notify = () => context.store.set({ version: state().version + 1 });

    /** The handle of that name, told the props of its newest render. */
    const recordOf = (props: HandleProps | HandleInputProps) => {
      const name = String(props.handle);
      let record = records.get(name);
      if (!record) {
        record = {
          dragging: false,
          gestures: createGestures<HandleGesture>(context),
          latest: null,
          props: props as HandleProps,
          uncontrolled: undefined,
        };
        records.set(name, record);
      } else if ("value" in props || "axis" in props) {
        // The props take over again on every render of the handle itself.
        record.props = props as HandleProps;
        record.latest = null;
      }
      return record;
    };
    const byName = (name: string) => recordOf({ handle: name });

    const moves = (record: HandleRecord, along: "x" | "y") => {
      const axis = record.props.axis ?? "both";
      return axis === "both" || axis === along;
    };
    const disabledOf = (record: HandleRecord) =>
      state().disabled || Boolean(record.props.disabled);
    const clampPoint = (value: PlotPoint): PlotPoint => {
      const { axes } = state();
      return {
        x: valueOn(axes.x, positionOn(axes.x, value.x)),
        y: valueOn(axes.y, positionOn(axes.y, value.y)),
      };
    };
    const positionOf = (point: PlotPoint): PlotPoint => {
      const { axes } = state();
      return { x: positionOn(axes.x, point.x), y: positionOn(axes.y, point.y) };
    };
    const defaultPoint = (record: HandleRecord): PlotPoint => {
      const { axes } = state();
      return (
        record.props.defaultValue ?? {
          x: valueOn(axes.x, 0.5),
          y: valueOn(axes.y, 0.5),
        }
      );
    };
    /** The value the props or the handle hold: what a view shows. */
    const held = (record: HandleRecord) =>
      clampPoint(
        record.props.value ?? record.uncontrolled ?? defaultPoint(record)
      );
    /** The value as the gesture under way left it. */
    const current = (record: HandleRecord) => record.latest ?? held(record);

    /**
     * Clamps and proposes a value; keeps it unless refused, and returns the
     * value applied, or null. A commit reports that value: the handle may have
     * been drawn again, from props that lag, before it is made.
     */
    const change = (
      record: HandleRecord,
      next: PlotPoint,
      reason: string,
      event: Event
    ) => {
      const clamped = clampPoint(next);
      const now = current(record);
      if (clamped.x === now.x && clamped.y === now.y) {
        return null;
      }
      const source = sourceOf(event);
      const canceled = dispatch(context, "onValueChange", clamped, {
        event,
        handle: String(record.props.handle),
        reason,
        ...(source ? { source } : {}),
      });
      if (canceled) {
        return null;
      }
      record.latest = clamped;
      if (record.props.value === undefined) {
        record.uncontrolled = clamped;
      }
      notify();
      return clamped;
    };
    const commit = (
      record: HandleRecord,
      value: PlotPoint,
      reason: string,
      event: Event
    ) =>
      dispatch(context, "onValueCommitted", value, {
        event,
        handle: String(record.props.handle),
        reason,
      });

    /** Moves a handle to positions along each axis, 0 to 1, for the axes it moves along. */
    const moveTo = (
      record: HandleRecord,
      position: PlotPoint,
      reason: string,
      event: Event
    ) => {
      const { axes } = state();
      const now = current(record);
      return change(
        record,
        {
          x: moves(record, "x") ? valueOn(axes.x, position.x) : now.x,
          y: moves(record, "y") ? valueOn(axes.y, position.y) : now.y,
        },
        reason,
        event
      );
    };

    const reset = (record: HandleRecord, event: Event) => {
      if (disabledOf(record)) {
        return;
      }
      const target = positionOf(clampPoint(defaultPoint(record)));
      const applied = moveTo(record, target, "reset", event);
      if (applied) {
        commit(record, applied, "reset", event);
      }
    };

    const finish = (
      record: HandleRecord,
      gesture: HandleGesture,
      end: PointerEvent
    ) => {
      record.dragging = false;
      notify();
      if (gesture.changed) {
        commit(record, gesture.value ?? current(record), "drag", end);
      }
    };

    return {
      cursor: createWritable<PlotPoint | null>(null),
      handleView: (now: PlotState, props: HandleProps | HandleInputProps) => {
        const record = recordOf(props);
        const value = held(record);
        return {
          axis: record.props.axis ?? "both",
          disabled: now.disabled || Boolean(record.props.disabled),
          dragging: record.dragging,
          position: {
            x: positionOn(now.axes.x, value.x),
            y: positionOn(now.axes.y, value.y),
          },
          value,
        };
      },
      internal: { keyOf: (handle: unknown) => String(handle) },
      keyDown: (name: string, event: KeyboardEvent) => {
        const record = byName(name);
        if (disabledOf(record)) {
          return false;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          reset(record, event);
          return true;
        }
        const step = event.shiftKey ? LARGE_KEY_STEP : KEY_STEP;
        const at = positionOf(current(record));
        // Home and End go to the ends of the axis the handle moves along first.
        const ends = moves(record, "x") ? "x" : "y";
        const target = {
          ArrowDown: { x: at.x, y: at.y - step },
          ArrowLeft: { x: at.x - step, y: at.y },
          ArrowRight: { x: at.x + step, y: at.y },
          ArrowUp: { x: at.x, y: at.y + step },
          End: { ...at, [ends]: 1 },
          Home: { ...at, [ends]: 0 },
          PageDown: { x: at.x, y: at.y - LARGE_KEY_STEP },
          PageUp: { x: at.x, y: at.y + LARGE_KEY_STEP },
        }[event.key];
        if (!target) {
          return false;
        }
        const applied = moveTo(record, target, "keyboard", event);
        if (applied) {
          commit(record, applied, "keyboard", event);
        }
        return true;
      },
      measure,
      press: (name: string, event: PointerEvent, element: HTMLElement) => {
        const record = byName(name);
        if (
          disabledOf(record) ||
          event.button !== 0 ||
          !record.gestures.accepts(event, (stale) =>
            finish(record, stale, event)
          )
        ) {
          return;
        }
        // An Alt press returns to the default, as in a DAW.
        if (event.altKey) {
          reset(record, event);
          return;
        }
        const gesture: HandleGesture = {
          changed: false,
          fine: event.shiftKey,
          origin: positionOf(current(record)),
          rect: measure(true),
          start: { x: event.clientX, y: event.clientY },
          value: null,
        };
        record.dragging = true;
        notify();
        record.gestures.start(element, event, gesture, {
          onEnd: (end) => finish(record, gesture, end),
          onMove: (move) => {
            const box = gesture.rect;
            if (!box) {
              return;
            }
            // Shift pressed or let go mid-drag: carry on from here at the new speed.
            if (move.shiftKey !== gesture.fine) {
              gesture.fine = move.shiftKey;
              gesture.origin = positionOf(current(record));
              gesture.start = { x: move.clientX, y: move.clientY };
            }
            const speed = gesture.fine ? FINE_DRAG : 1;
            const along = {
              x:
                gesture.origin.x +
                ((move.clientX - gesture.start.x) / Math.max(box.width, 1)) *
                  speed,
              y:
                gesture.origin.y -
                ((move.clientY - gesture.start.y) / Math.max(box.height, 1)) *
                  speed,
            };
            const applied = moveTo(record, along, "drag", move);
            if (applied) {
              gesture.changed = true;
              gesture.value = applied;
            }
          },
        });
      },
      reset: (name: string, event: Event) => reset(byName(name), event),
      root,
      typeAt: (
        name: string,
        along: "x" | "y",
        position: number,
        event: Event
      ) => {
        const record = byName(name);
        const at = positionOf(current(record));
        const applied = moveTo(
          record,
          { ...at, [along]: position },
          "input-change",
          event
        );
        if (applied) {
          commit(record, applied, "input-change", event);
        }
      },
    };
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
          const view = api.handleView(state, props);
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
          change: (event, { api, el, props }) =>
            api.typeAt(
              String(props.handle),
              along,
              Number((el as HTMLInputElement).value),
              event
            ),
          keydown: (event, { api, props }) => {
            if (api.keyDown(String(props.handle), event)) {
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
            ? curveOf(state.axes, props.fn, props.samples, props.fillTo)
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
          const listen = (plotEl: HTMLElement) => {
            const handleMove = (event: PointerEvent) => {
              if (event.pointerType === "touch") {
                return;
              }
              const box = part.api.measure();
              if (!box) {
                return;
              }
              const { axes } = part.store.get();
              const across = clamp(
                (event.clientX - box.left) / box.width,
                0,
                1
              );
              const down = clamp((event.clientY - box.top) / box.height, 0, 1);
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
          queueMicrotask(() => {
            const plotEl = part.api.root.el ?? el.parentElement;
            if (disposed || !plotEl) {
              return;
            }
            detach = listen(plotEl);
          });
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
        { source?: PlotSource<PlotPoint>; value?: PlotPoint },
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
          const view = api.handleView(state, props);
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
          dblclick: (event, { api, props }) =>
            api.reset(String(props.handle), event),
          pointerdown: (event, { api, el, props, store }) => {
            if (
              !el ||
              event.button !== 0 ||
              api.handleView(store.get(), props).disabled
            ) {
              return;
            }
            event.preventDefault();
            if (!event.altKey) {
              el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
                preventScroll: true,
              });
            }
            api.press(String(props.handle), event, el);
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
          const view = api.handleView(state, props);
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
          source: PlotSource<ArrayLike<number>>;
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
          const paint = () =>
            paintPath(
              el,
              traceOf(part.store.get().axes, source.getSnapshot(), part.props)
            );
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
            ? traceOf(state.axes, props.source.getSnapshot(), props)
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