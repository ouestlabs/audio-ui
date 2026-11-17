import {
  css,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { clamp, numberFormatter } from "@ui-sdk/core/number";
import {
  type ChangeDetails,
  type CommitDetails,
  createGestures,
  createReporter,
  definePrimitive,
  flag,
  formatPair,
} from "../primitive";

export type { ChangeDetails, CommitDetails } from "../primitive";

/**
 * The breakpoint envelope: points to drag, segments to bend, keys, a grid,
 * additions and removals within the least and most points.
 *
 * The points are `{ x, y, curve? }`, each normalized to 0 to 1 on both axes
 * and kept sorted by `x`. A point and a segment are keyed by their `index`, as
 * the items of a collection: the app writes one part for each.
 */

/**
 * A point of the ramp, and how the segment leaving it bends: `curve` from -1
 * to 1, 0 or unset for a straight line. A positive curve holds the start of
 * the segment and rushes its end, a negative one the opposite. The last
 * point's curve has no segment to bend.
 */
export interface Breakpoint {
  curve?: number;
  x: number;
  y: number;
}

/** A grid step in normalized units: one for both axes, or one for each (0 leaves that axis free). */
export type EnvelopeSnap = number | { x: number; y: number };

/** How far a segment can bend: the rate of its exponential at the ends of -1 to 1. */
const CURVE_RATE = 11;
/** Straight lines between samples of a bent segment: where its drawing starts, before it adds vertices where the bend is tight. */
const CURVE_SAMPLES = 24;
/** How far a bent segment's drawing may stray from it, as a share of the graph: a tenth of a pixel on a graph 200 px high. */
const CURVE_TOLERANCE = 0.0005;
/** A curve this close to flat is taken as straight, and dropped. */
const CURVE_EPSILON = 0.005;
/** Keyboard step for a segment's curve, as a multiple of `step`. */
const CURVE_STEP_MULTIPLIER = 5;
/** Shift with the arrows moves this many steps at once. */
const LARGE_STEP_MULTIPLIER = 10;
/** How far from a curve, as a share of the graph's height, a press still counts as on it. */
const CURVE_HIT_TOLERANCE = 0.12;
/** With Shift held a drag moves this share of the pointer's distance. */
const FINE_RATIO = 0.25;
/** How long a refused action is signalled, long enough for a feedback animation to play. */
const BLOCKED_DURATION_MS = 320;
/** Where in an interval a curve is checked against its chord, how many times an interval may be halved, and a ceiling on the vertices of one curve. */
const PROBES = [0.25, 0.5, 0.75];
const MAX_DEPTH = 8;
const MAX_SAMPLES = 4096;
/** ADSR-shaped: attack to peak, decay to a sustain plateau, release. */
const DEFAULT_VALUE: Breakpoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

/**
 * Where along a bent segment a share `t` of its length lands, as a share of
 * its rise: the exponential of an analog envelope stage.
 */
function segmentShape(t: number, curve: number | undefined) {
  if (!curve) {
    return t;
  }
  const rate = curve * CURVE_RATE;
  return Math.expm1(rate * t) / Math.expm1(rate);
}

/** Where a bent segment is at a share `t` of its length, as a level. */
const levelAt = (from: Breakpoint, to: Breakpoint, t: number) =>
  from.y + (to.y - from.y) * segmentShape(t, from.curve);

/** The curve that puts a segment's midpoint at height `y`, or null when the segment is flat. */
function curveForMidpoint(from: Breakpoint, to: Breakpoint, y: number) {
  const rise = to.y - from.y;
  if (Math.abs(rise) < 1e-6) {
    return null;
  }
  // The middle of the exponential is at 1 / (e^(k/2) + 1), so k = 2 ln((1 - share) / share).
  const share = clamp((y - from.y) / rise, 0.001, 0.999);
  return clamp((2 * Math.log((1 - share) / share)) / CURVE_RATE, -1, 1);
}

const sortPoints = <T extends Breakpoint>(points: T[]) =>
  [...points].sort((a, b) => a.x - b.x);

/** The points kept on the graph: each within 0 and 1, a curve within -1 and 1 (dropped when it is flat), in order along x. */
function sanitizePoints(points: readonly Breakpoint[]): Breakpoint[] {
  return sortPoints(
    points.map((p) => {
      const point: Breakpoint = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
      if (p.curve !== undefined && Math.abs(p.curve) >= CURVE_EPSILON) {
        point.curve = clamp(p.curve, -1, 1);
      }
      return point;
    })
  );
}

/** Whether two lists hold the same points, curves included, in the same order. */
const samePoints = (a: Breakpoint[], b: Breakpoint[]) =>
  a.length === b.length &&
  a.every(
    (point, i) =>
      point.x === b[i]?.x && point.y === b[i]?.y && point.curve === b[i]?.curve
  );

/** A candidate point with its x kept between its neighbors, so points never cross, and y within the graph. */
function clampToNeighbors(
  base: Breakpoint[],
  index: number,
  next: { x: number; y: number }
) {
  if (!base[index]) {
    return null;
  }
  const prev = base[index - 1];
  const after = base[index + 1];
  return {
    x: clamp(next.x, prev ? prev.x : 0, after ? after.x : 1),
    y: clamp(next.y, 0, 1),
  };
}

/**
 * `point` added to `base`. Added inside a bent segment it sits on the curve,
 * and each half gets the curve that traces the part of the original it
 * replaces, so adding a point does not change the shape.
 */
function insertPoint(base: Breakpoint[], point: { x: number; y: number }) {
  const x = clamp(point.x, 0, 1);
  const y = clamp(point.y, 0, 1);
  const leftIndex = base.findLastIndex((existing) => existing.x <= x);
  const left = base[leftIndex];
  const right = base[leftIndex + 1];
  if (left?.curve && right && right.x > left.x) {
    const t = (x - left.x) / (right.x - left.x);
    const onCurve = (share: number) => levelAt(left, right, share);
    const added: Breakpoint = { x, y: onCurve(t) };
    const leftCurve = curveForMidpoint(left, added, onCurve(t / 2));
    const rightCurve = curveForMidpoint(added, right, onCurve((1 + t) / 2));
    const { curve: _bent, ...straightLeft } = left;
    const value = [...base];
    value[leftIndex] =
      leftCurve === null || Math.abs(leftCurve) < CURVE_EPSILON
        ? straightLeft
        : { ...straightLeft, curve: leftCurve };
    if (rightCurve !== null && Math.abs(rightCurve) >= CURVE_EPSILON) {
      added.curve = rightCurve;
    }
    value.splice(leftIndex + 1, 0, added);
    return { index: leftIndex + 1, value };
  }
  const added: Breakpoint = { x, y };
  const value = sortPoints([...base, added]);
  return { index: value.indexOf(added), value };
}

/** How far a key bends a segment, or null for a key that does not: up lifts the handle. */
function curveKeyDelta(
  event: KeyboardEvent,
  from: Breakpoint,
  to: Breakpoint,
  step: number
) {
  const direction = { ArrowDown: -1, ArrowUp: 1 }[event.key];
  if (direction === undefined) {
    return null;
  }
  const lift = to.y > from.y ? -1 : 1;
  return (
    direction *
    lift *
    step *
    CURVE_STEP_MULTIPLIER *
    (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1)
  );
}

/** Rounds a normalized coordinate to the nearest multiple of `step`; a step of 0 leaves it. */
const snapTo = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : value;

/** A point on the grid of `snap`. */
const snapPoint = (at: { x: number; y: number }, snap: EnvelopeSnap) =>
  typeof snap === "number"
    ? { x: snapTo(at.x, snap), y: snapTo(at.y, snap) }
    : { x: snapTo(at.x, snap.x), y: snapTo(at.y, snap.y) };

/** The segment that has the point (x, y) on it or close to it, or null: one that is not flat. */
function segmentNear(value: Breakpoint[], x: number, y: number) {
  for (let index = 0; index < value.length - 1; index += 1) {
    const from = value[index];
    const to = value[index + 1];
    if (!(from && to) || x < from.x || x > to.x || to.x <= from.x) {
      continue;
    }
    if (Math.abs(to.y - from.y) < 1e-6) {
      return null;
    }
    const at = levelAt(from, to, (x - from.x) / (to.x - from.x));
    return Math.abs(at - y) <= CURVE_HIT_TOLERANCE ? index : null;
  }
  return null;
}

/**
 * The vertices of a polyline that draws `f(t)` for `t` from 0 to 1 without
 * straying more than `tolerance` from it: it starts from `grid` and halves
 * every interval whose curve leaves its chord. `width` is how wide `t` from 0
 * to 1 spans in the box the curve is drawn in.
 */
function adaptiveSamples(
  f: (t: number) => number,
  grid: readonly number[],
  tolerance: number,
  width: number
) {
  const samples: [number, number][] = [];
  let budget = MAX_SAMPLES - grid.length;
  const refine = (
    from: number,
    start: number,
    to: number,
    end: number,
    depth: number
  ) => {
    if (depth >= MAX_DEPTH || budget <= 0) {
      return;
    }
    let stray = 0;
    let middle = Number.NaN;
    for (const probe of PROBES) {
      const value = f(from + (to - from) * probe);
      stray = Math.max(
        stray,
        Math.abs(value - (start + (end - start) * probe))
      );
      if (probe === 0.5) {
        middle = value;
      }
    }
    const slope = (end - start) / ((to - from) * width);
    if (stray / Math.sqrt(1 + slope * slope) <= tolerance) {
      return;
    }
    const half = (from + to) / 2;
    budget -= 1;
    refine(from, start, half, middle, depth + 1);
    samples.push([half, middle]);
    refine(half, middle, to, end, depth + 1);
  };
  const values = grid.map(f);
  grid.forEach((t, index) => {
    const value = values[index] ?? 0;
    samples.push([t, value]);
    const next = grid[index + 1];
    if (next !== undefined) {
      refine(t, value, next, values[index + 1] ?? 0, 0);
    }
  });
  return samples;
}

/** Where along a bent segment to put the vertices of its drawing: evenly in length, and evenly in height. */
function curveSamples(curve: number) {
  const rate = curve * CURVE_RATE;
  const samples = new Set<number>();
  for (let sample = 1; sample < CURVE_SAMPLES; sample += 1) {
    const share = sample / CURVE_SAMPLES;
    samples.add(share);
    samples.add(Math.log1p(share * Math.expm1(rate)) / rate);
  }
  return [...samples].filter((t) => t > 0 && t < 1).sort((a, b) => a - b);
}

/** Polyline coordinates in a 100 by 100 view box: flat lead-in from x 0 to the first point, the points with each bent segment sampled between them, flat lead-out to x 100. */
export function polylinePoints(value: Breakpoint[]): string {
  const [first] = value;
  const last = value.at(-1);
  if (!(first && last)) {
    return "";
  }
  // A graph stretched across a long arrangement keeps four decimals of x, so a bend is not drawn in steps.
  const coordinate = (x: number, y: number) =>
    `${Math.round(x * 1e6) / 1e4},${Math.round((1 - y) * 1000) / 10}`;
  const coordinates = [coordinate(0, first.y)];
  value.forEach((point, index) => {
    coordinates.push(coordinate(point.x, point.y));
    const next = value[index + 1];
    if (!(next && point.curve)) {
      return;
    }
    const bent = adaptiveSamples(
      (t) => levelAt(point, next, t),
      [0, ...curveSamples(point.curve), 1],
      CURVE_TOLERANCE,
      next.x - point.x
    );
    for (const [t, level] of bent.slice(1, -1)) {
      coordinates.push(coordinate(point.x + (next.x - point.x) * t, level));
    }
  });
  coordinates.push(coordinate(1, last.y));
  return coordinates.join(" ");
}

export interface EnvelopePrimitiveOptions {
  /** Uncontrolled starting points. Defaults to an ADSR-like shape. */
  defaultValue?: Breakpoint[];
  disabled?: boolean;
  /** How point coordinates are written, e.g. `{ maximumFractionDigits: 2 }`. */
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
  /** Ceiling on the number of points; adding is blocked at this count. */
  maxPoints?: number;
  /** Floor on the number of points; removal is blocked at this count. @default 2 */
  minPoints?: number;
  onValueChange?: (value: Breakpoint[], details: ChangeDetails) => void;
  onValueCommitted?: (value: Breakpoint[], details: CommitDetails) => void;
  /** Grid points snap to, in normalized units, one step for both axes or one for each; 0 is no grid. @default 0 */
  snap?: EnvelopeSnap;
  /** Keyboard step on both axes, in normalized units. @default 0.01 */
  step?: number;
  /** The controlled points; leave it out for the envelope to hold its own. */
  value?: Breakpoint[];
}

export interface EnvelopeState {
  /** The point whose removal was just refused, for a short feedback signal. */
  blockedIndex: number | null;
  disabled: boolean;
  /** Where a drag has taken the points, held until release so a controlled value that lags cannot pull them back. */
  draft: Breakpoint[] | null;
  /** The point being dragged, if any. */
  draggingIndex: number | null;
  /** The segment being bent, if any. */
  draggingSegmentIndex: number | null;
  /** The roving tab stop among the points. */
  focused: number;
  /** The roving tab stop among the segments' handles. */
  focusedSegment: number;
  format: Intl.NumberFormatOptions | undefined;
  /** Whether an addition was just refused, for a short feedback signal. */
  isAddBlocked: boolean;
  locale: Intl.LocalesArgument | undefined;
  maxPoints: number;
  minPoints: number;
  snap: EnvelopeSnap;
  step: number;
  /** The points the app holds, or the envelope's own. */
  value: Breakpoint[];
}

/** What a view draws an envelope from. */
export interface EnvelopeSnapshot {
  blockedIndex: number | null;
  disabled: boolean;
  /** Whether a point or a segment is being dragged. */
  dragging: boolean;
  draggingIndex: number | null;
  draggingSegmentIndex: number | null;
  isAddBlocked: boolean;
  minPoints: number;
  /** The `points` of the line's polyline. */
  points: string;
  /** The points as displayed: the dragged ones while a pointer moves them. */
  value: Breakpoint[];
}

const views = new WeakMap<EnvelopeState, EnvelopeSnapshot>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: EnvelopeState): EnvelopeSnapshot {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const value = state.draft ?? sanitizePoints(state.value);
  const view: EnvelopeSnapshot = {
    blockedIndex: state.blockedIndex,
    disabled: state.disabled,
    dragging:
      state.draggingIndex !== null || state.draggingSegmentIndex !== null,
    draggingIndex: state.draggingIndex,
    draggingSegmentIndex: state.draggingSegmentIndex,
    isAddBlocked: state.isAddBlocked,
    minPoints: state.minPoints,
    points: polylinePoints(value),
    value,
  };
  views.set(state, view);
  return view;
}

const displayed = (state: EnvelopeState) => viewOf(state).value;

/** The state attributes every part carries. */
const stateAttrs = (state: EnvelopeState) => ({
  "data-disabled": flag(state.disabled),
  "data-dragging": flag(viewOf(state).dragging),
});

/** What a part's className, style and children functions read. */
export interface EnvelopePublicState {
  /** Briefly true after an addition was refused at `maxPoints`. */
  blocked: boolean;
  disabled: boolean;
  /** Whether a point or a segment is being dragged. */
  dragging: boolean;
  /** The points, sorted by `x`. */
  value: Breakpoint[];
}

/** What the line and the fill read: the state and the `points` of their polyline. */
export interface ShapeState extends EnvelopePublicState {
  points: string;
}

/** What a point reads of itself. */
export interface PointState {
  /** Briefly true after a removal was refused at `minPoints`. */
  blocked: boolean;
  disabled: boolean;
  dragging: boolean;
  index: number;
  /** Whether the point can be removed now. */
  removable: boolean;
  value: Breakpoint[];
}

/** What a segment reads of itself. */
export interface SegmentState {
  /** The bend, from -1 to 1. */
  curve: number;
  disabled: boolean;
  dragging: boolean;
  /** Whether it joins two points of the same level, so there is nothing to bend. */
  flat: boolean;
  index: number;
  value: Breakpoint[];
}

const publicState = (state: EnvelopeState): EnvelopePublicState => {
  const view = viewOf(state);
  return {
    blocked: view.isAddBlocked,
    disabled: view.disabled,
    dragging: view.dragging,
    value: view.value,
  };
};

const pointState = (state: EnvelopeState, index: number): PointState => {
  const view = viewOf(state);
  return {
    blocked: view.blockedIndex === index,
    disabled: view.disabled,
    dragging: view.draggingIndex === index,
    index,
    removable: view.value.length > view.minPoints,
    value: view.value,
  };
};

const segmentState = (state: EnvelopeState, index: number): SegmentState => {
  const view = viewOf(state);
  const from = view.value[index];
  const to = view.value[index + 1];
  return {
    curve: from?.curve ?? 0,
    disabled: view.disabled,
    dragging: view.draggingSegmentIndex === index,
    flat: from && to ? Math.abs(to.y - from.y) < 1e-6 : true,
    index,
    value: view.value,
  };
};

/** What an envelope's `api` gives an adapter. */
export interface EnvelopeApi {
  /** Adds a point at `at`, 0 to 1 of the graph, snapped unless Cmd or Ctrl is held, and moves the tab stop to it; blocked at `maxPoints`. */
  addPoint: (at: { x: number; y: number }, event: MouseEvent) => void;
  focusPoint: (index: number) => void;
  focusSegment: (index: number) => void;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (index: unknown) => string };
  /** Handles a key on a point: arrows move it, Delete or Backspace removes it. Returns whether the point took the key. */
  keyPoint: (index: number, event: KeyboardEvent) => boolean;
  /** Handles a key on a segment's handle: Up and Down bend it, Delete or Backspace straightens it. Returns whether it took the key. */
  keySegment: (index: number, event: KeyboardEvent) => boolean;
  /** The element of each point, to move the focus to. */
  points: Map<number, HTMLElement>;
  /** Starts an Alt press on the graph: a drag bends the segment under the pointer. */
  pressBend: (event: PointerEvent, graph: HTMLElement) => void;
  /** Starts a press on a point: a drag moves it. */
  pressPoint: (
    index: number,
    event: PointerEvent,
    handle: HTMLElement,
    graph: HTMLElement
  ) => void;
  /** Starts a press on a segment's handle: a drag bends it. */
  pressSegment: (
    index: number,
    event: PointerEvent,
    handle: HTMLElement,
    graph: HTMLElement
  ) => void;
  /** Removes a point, and moves the tab stop to the one that takes its place; blocked at `minPoints`. */
  removePoint: (index: number, event: MouseEvent | KeyboardEvent) => void;
  segments: Map<number, HTMLElement>;
  /** Moves the points from outside, as a property does: no change is reported. */
  set: (points: Breakpoint[]) => void;
  /** Straightens the segment under `at`, if there is one. */
  straightenAt: (at: { x: number; y: number }, event: MouseEvent) => void;
  /** Straightens a segment, as a double click or Delete on its handle does. */
  straightenSegment: (index: number, event: MouseEvent | KeyboardEvent) => void;
  /** The points as displayed. */
  value: () => Breakpoint[];
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a point. */
interface PointProps extends PartProps {
  getAriaValueText?: (point: Breakpoint, index: number) => string;
  index: number;
}

/** The props of a segment's handle: the index of the point it leaves from. */
interface SegmentProps extends PartProps {
  getAriaValueText?: (curve: number, index: number) => string;
  index: number;
}

/** The props of a drawing part. */
interface ShapeProps extends PartProps {
  strokeWidth?: number;
}

/** The envelope's slots, by name, with the props and the public state of each. */
export type EnvelopeSlots = {
  fill: SlotDefinition<EnvelopeState, EnvelopeApi, ShapeProps, ShapeState>;
  graph: SlotDefinition<
    EnvelopeState,
    EnvelopeApi,
    PartProps,
    EnvelopePublicState
  >;
  line: SlotDefinition<EnvelopeState, EnvelopeApi, ShapeProps, ShapeState>;
  point: SlotDefinition<EnvelopeState, EnvelopeApi, PointProps, PointState>;
  root: SlotDefinition<
    EnvelopeState,
    EnvelopeApi,
    PartProps,
    EnvelopePublicState
  >;
  segment: SlotDefinition<
    EnvelopeState,
    EnvelopeApi,
    SegmentProps,
    SegmentState
  >;
};

/**
 * The type of `envelope`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface EnvelopePrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: EnvelopeSlots;
  (
    initialOptions: EnvelopePrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: EnvelopeApi;
    get: () => EnvelopeState;
    types: {
      api: EnvelopeApi;
      options: EnvelopePrimitiveOptions;
      slots: EnvelopeSlots;
      state: EnvelopeState;
    };
  };
}

const GRAPH = '[data-slot="envelope-graph"]';

/** The graph a point or a segment is dragged over, found from the point's element. */
const graphOf = (el: HTMLElement | undefined) =>
  el?.closest('[data-slot="envelope"]')?.querySelector<HTMLElement>(GRAPH) ??
  undefined;

/** A pointer's place in the graph, 0 to 1 from the left and from the bottom, or null while it has no size. */
function pointOf(event: MouseEvent, graph: Element) {
  const rect = graph.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: 1 - (event.clientY - rect.top) / rect.height,
  };
}

/** What a drawing part is: an `<svg>` over the graph, stretched to it, holding one polyline. */
const shapeAttrs = (state: EnvelopeState) => ({
  ...stateAttrs(state),
  "aria-hidden": "true",
  preserveAspectRatio: "none",
  style: css({
    height: "100%",
    inset: "0",
    position: "absolute",
    width: "100%",
  }),
  viewBox: "0 0 100 100",
});

/** One pointer gesture: a point moved, a segment bent by its handle, or one bent by an Alt drag on the graph. */
interface Gesture {
  changed: boolean;
  /** While Shift is held: where the pointer and the point were when it went down. */
  fine: { pointer: { x: number; y: number }; point: Breakpoint } | null;
  index: number;
  kind: "bend" | "point" | "segment";
  /** For a bend: where the segment's midpoint and the pointer were at the press. */
  startLevel: number;
  startY: number;
}

/** The state an options object asks for, with the defaults of the envelope. */
const stateOf = (options: EnvelopePrimitiveOptions) => ({
  disabled: options.disabled ?? false,
  format: options.format,
  locale: options.locale,
  maxPoints: options.maxPoints ?? Number.POSITIVE_INFINITY,
  minPoints: options.minPoints ?? 2,
  snap: options.snap ?? 0,
  step: options.step ?? 0.01,
});

export const envelope: EnvelopePrimitive = definePrimitive({
  api: (context) => {
    const { commit, report, state } = createReporter(context, displayed);
    const set = (next: Partial<EnvelopeState>) =>
      context.store.set(next as never);
    const gestures = createGestures<Gesture>(context);
    const points = new Map<number, HTMLElement>();
    const segments = new Map<number, HTMLElement>();

    /** Proposes the points; keeps them unless refused, and says whether they changed. */
    const propose = (
      next: Breakpoint[],
      reason: string,
      event: Event,
      index: number
    ) => {
      if (
        samePoints(next, displayed(state())) ||
        !report(next, reason, event, { index })
      ) {
        return false;
      }
      if (gestures.active()) {
        set({ draft: next });
      }
      return true;
    };
    /** A change that is over as soon as it is made: keys, additions, removals, straightening. */
    const settle = (
      next: Breakpoint[],
      reason: string,
      event: Event,
      index: number
    ) => {
      if (propose(next, reason, event, index)) {
        commit(next, reason, event, { index });
        return true;
      }
      return false;
    };

    /** The points with one moved, clamped between its neighbors, or null. */
    const moved = (index: number, target: { x: number; y: number }) => {
      const base = displayed(state());
      const clamped = clampToNeighbors(base, index, target);
      if (!clamped) {
        return null;
      }
      const next = [...base];
      next[index] = { ...base[index], ...clamped };
      return next;
    };

    /** The points with the segment leaving `index` bent, or null. */
    const bent = (index: number, curve: number) => {
      const base = displayed(state());
      const point = base[index];
      if (!(point && base[index + 1])) {
        return null;
      }
      const { curve: _previous, ...rest } = point;
      const next = [...base];
      const value = clamp(curve, -1, 1);
      next[index] =
        Math.abs(value) < CURVE_EPSILON ? rest : { ...rest, curve: value };
      return next;
    };

    // A refused action is cleared, then signalled on the next frame, so a
    // feedback animation replays even when it is refused twice in a row.
    const timers = { add: 0, point: 0 };
    const frames = { add: 0, point: 0 };
    const signal = (kind: "add" | "point", on: Partial<EnvelopeState>) => {
      const off =
        kind === "add" ? { isAddBlocked: false } : { blockedIndex: null };
      clearTimeout(timers[kind]);
      cancelAnimationFrame(frames[kind]);
      set(off);
      frames[kind] = requestAnimationFrame(() => {
        set(on);
        timers[kind] = window.setTimeout(() => set(off), BLOCKED_DURATION_MS);
      });
    };
    context.onDestroy(() => {
      for (const kind of ["add", "point"] as const) {
        clearTimeout(timers[kind]);
        cancelAnimationFrame(frames[kind]);
      }
    });

    /** Removes a point; blocked at `minPoints`. Says whether it went. */
    const remove = (index: number, event: MouseEvent | KeyboardEvent) => {
      const current = state();
      if (current.disabled) {
        return false;
      }
      const base = displayed(current);
      if (base.length <= current.minPoints) {
        signal("point", { blockedIndex: index });
        return false;
      }
      return settle(
        base.filter((_, i) => i !== index),
        "remove",
        event,
        index
      );
    };

    const focusPoint = (index: number) => {
      set({ focused: index });
      points.get(index)?.focus();
    };

    const straightenSegment = (
      index: number,
      event: MouseEvent | KeyboardEvent
    ) => {
      if (state().disabled) {
        return;
      }
      const next = bent(index, 0);
      if (next) {
        settle(next, "curve", event, index);
      }
    };

    /** Ends a gesture, committing it if it changed the points. */
    const finish = (gesture: Gesture, end: PointerEvent) => {
      const settled = displayed(state());
      set({ draft: null, draggingIndex: null, draggingSegmentIndex: null });
      if (gesture.changed) {
        commit(settled, gesture.kind === "point" ? "drag" : "curve", end, {
          index: gesture.index,
        });
      }
    };

    /** Whether a press may start a gesture, ending a stale one of the same pointer first. */
    const accepts = (event: PointerEvent) =>
      !state().disabled &&
      event.button === 0 &&
      gestures.accepts(event, (stale) => finish(stale, event));

    const begin = (
      index: number,
      kind: Gesture["kind"],
      extra: Partial<Gesture> = {}
    ) => {
      set(
        kind === "point"
          ? { draggingIndex: index }
          : { draggingSegmentIndex: index }
      );
      return {
        changed: false,
        fine: null,
        index,
        kind,
        startLevel: 0,
        startY: 0,
        ...extra,
      } satisfies Gesture;
    };

    return {
      addPoint: (at: { x: number; y: number }, event: MouseEvent) => {
        const current = state();
        if (current.disabled) {
          return;
        }
        const base = displayed(current);
        if (base.length >= current.maxPoints) {
          signal("add", { isAddBlocked: true });
          return;
        }
        const free = event.metaKey || event.ctrlKey;
        const { index, value } = insertPoint(
          base,
          free ? at : snapPoint(at, current.snap)
        );
        if (settle(value, "add", event, index)) {
          set({ focused: index });
        }
      },
      focusPoint,
      focusSegment: (index: number) => {
        const last = Math.max(0, displayed(state()).length - 2);
        const target = clamp(index, 0, last);
        set({ focusedSegment: target });
        segments.get(target)?.focus();
      },
      internal: { keyOf: (index: unknown) => String(index) },
      keyPoint: (index: number, event: KeyboardEvent) => {
        const current = state();
        const point = displayed(current)[index];
        if (current.disabled || !point) {
          return false;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          remove(index, event);
          return true;
        }
        const distance =
          current.step * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
        const target = {
          ArrowDown: { x: point.x, y: point.y - distance },
          ArrowLeft: { x: point.x - distance, y: point.y },
          ArrowRight: { x: point.x + distance, y: point.y },
          ArrowUp: { x: point.x, y: point.y + distance },
        }[event.key];
        if (!target) {
          return false;
        }
        const next = moved(index, target);
        if (next) {
          settle(next, "keyboard", event, index);
        }
        return true;
      },
      keySegment: (index: number, event: KeyboardEvent) => {
        const current = state();
        const left = displayed(current)[index];
        const right = displayed(current)[index + 1];
        if (
          current.disabled ||
          !(left && right) ||
          Math.abs(right.y - left.y) < 1e-6
        ) {
          return false;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          straightenSegment(index, event);
          return true;
        }
        const delta = curveKeyDelta(event, left, right, current.step);
        if (delta === null) {
          return false;
        }
        const next = bent(index, (left.curve ?? 0) + delta);
        if (next) {
          settle(next, "curve", event, index);
        }
        return true;
      },
      points,
      pressBend: (event: PointerEvent, graph: HTMLElement) => {
        if (!(event.altKey && accepts(event))) {
          return;
        }
        const at = pointOf(event, graph);
        const base = displayed(state());
        const index = at ? segmentNear(base, at.x, at.y) : null;
        const from = base[index ?? 0];
        const to = base[(index ?? 0) + 1];
        if (index === null || !(from && to)) {
          return;
        }
        const gesture = begin(index, "bend", {
          startLevel: levelAt(from, to, 0.5),
          startY: event.clientY,
        });
        gestures.start(graph, event, gesture, {
          onEnd: (end) => finish(gesture, end),
          onMove: (move) => {
            const now = displayed(state());
            const left = now[index];
            const right = now[index + 1];
            const rect = graph.getBoundingClientRect();
            if (rect.height <= 0 || !(left && right)) {
              return;
            }
            const curve = curveForMidpoint(
              left,
              right,
              gesture.startLevel + (gesture.startY - move.clientY) / rect.height
            );
            const next = curve === null ? null : bent(index, curve);
            if (next && propose(next, "curve", move, index)) {
              gesture.changed = true;
            }
          },
        });
      },
      pressPoint: (
        index: number,
        event: PointerEvent,
        handle: HTMLElement,
        graph: HTMLElement
      ) => {
        if (!accepts(event)) {
          return;
        }
        // Alt and a press removes the point, as in a DAW's automation lane.
        if (event.altKey) {
          remove(index, event);
          return;
        }
        const gesture = begin(index, "point");
        gestures.start(handle, event, gesture, {
          onEnd: (end) => finish(gesture, end),
          onMove: (move) => {
            const pointer = pointOf(move, graph);
            if (!pointer) {
              return;
            }
            let target = pointer;
            if (move.shiftKey) {
              gesture.fine ??= {
                point: displayed(state())[index] ?? pointer,
                pointer,
              };
              const { fine } = gesture;
              target = {
                x: fine.point.x + (pointer.x - fine.pointer.x) * FINE_RATIO,
                y: fine.point.y + (pointer.y - fine.pointer.y) * FINE_RATIO,
              };
            } else {
              gesture.fine = null;
              if (!(move.metaKey || move.ctrlKey)) {
                target = snapPoint(pointer, state().snap);
              }
            }
            const next = moved(index, target);
            if (next && propose(next, "drag", move, index)) {
              gesture.changed = true;
            }
          },
        });
      },
      pressSegment: (
        index: number,
        event: PointerEvent,
        handle: HTMLElement,
        graph: HTMLElement
      ) => {
        const base = displayed(state());
        const from = base[index];
        const to = base[index + 1];
        if (
          !(from && to) ||
          Math.abs(to.y - from.y) < 1e-6 ||
          !accepts(event)
        ) {
          return;
        }
        const gesture = begin(index, "segment");
        gestures.start(handle, event, gesture, {
          onEnd: (end) => finish(gesture, end),
          onMove: (move) => {
            const now = displayed(state());
            const left = now[index];
            const right = now[index + 1];
            const rect = graph.getBoundingClientRect();
            if (!(left && right) || rect.height <= 0) {
              return;
            }
            const curve = curveForMidpoint(
              left,
              right,
              1 - (move.clientY - rect.top) / rect.height
            );
            const next = curve === null ? null : bent(index, curve);
            if (next && propose(next, "curve", move, index)) {
              gesture.changed = true;
            }
          },
        });
      },
      removePoint: (index: number, event: MouseEvent | KeyboardEvent) => {
        if (remove(index, event)) {
          focusPoint(Math.min(index, displayed(state()).length - 1));
        }
      },
      segments,
      set: (value: Breakpoint[]) => set({ value }),
      straightenAt: (at: { x: number; y: number }, event: MouseEvent) => {
        const index = segmentNear(displayed(state()), at.x, at.y);
        if (index !== null) {
          straightenSegment(index, event);
        }
      },
      straightenSegment,
      value: () => displayed(state()),
    };
  },
  controlled: ["value"],
  name: "envelope",
  options: {
    defaultValue: "value",
    disabled: "boolean",
    format: "value",
    locale: "value",
    maxPoints: "number",
    minPoints: "number",
    onValueChange: "callback",
    onValueCommitted: "callback",
    snap: "value",
    step: "number",
    value: "value",
  },
  slots: (slot) => ({
    fill: slot<ShapeProps, ShapeState>({
      attrs: shapeAttrs,
      props: { strokeWidth: "number" },
      state: (state: EnvelopeState) => {
        const { points } = viewOf(state);
        return {
          ...publicState(state),
          // Closed down to the baseline.
          points: points ? `${points} 100,100 0,100` : "",
        };
      },
    }),
    graph: slot<object, EnvelopePublicState>({
      attrs: (state: EnvelopeState) => ({
        ...stateAttrs(state),
        "data-blocked": flag(state.isAddBlocked),
      }),
      on: {
        // A double click adds a point; with Alt it straightens the segment under it.
        dblclick: (event, { api, el }) => {
          const at = el ? pointOf(event, el) : null;
          if (!at) {
            return;
          }
          if (event.altKey) {
            api.straightenAt(at, event);
            return;
          }
          api.addPoint(at, event);
        },
        // With Alt held, a drag bends the segment under the pointer.
        pointerdown: (event, { api, el, store }) => {
          if (
            !el ||
            store.get().disabled ||
            !event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          api.pressBend(event, el);
        },
      },
      state: (state: EnvelopeState) => publicState(state),
    }),
    line: slot<ShapeProps, ShapeState>({
      attrs: shapeAttrs,
      props: { strokeWidth: "number" },
      state: (state: EnvelopeState) => ({
        ...publicState(state),
        points: viewOf(state).points,
      }),
    }),
    point: slot<PointProps, PointState>({
      attrs: (state: EnvelopeState, { props }) => {
        const index = Number(props.index);
        const point = displayed(state)[index];
        const current = pointState(state, index);
        return {
          ...stateAttrs(state),
          "aria-disabled": state.disabled ? "true" : undefined,
          "aria-valuemax": "1",
          "aria-valuemin": "0",
          "aria-valuenow": point ? String(point.y) : undefined,
          "aria-valuetext": point
            ? (props.getAriaValueText?.(point, index) ??
              formatPair(
                numberFormatter(
                  state.locale as string | undefined,
                  state.format
                ),
                point.x,
                point.y
              ))
            : undefined,
          "data-blocked": flag(current.blocked),
          "data-index": String(index),
          "data-removable": flag(current.removable),
          role: "slider",
          style: css({
            bottom: `${(point?.y ?? 0) * 100}%`,
            left: `${(point?.x ?? 0) * 100}%`,
            position: "absolute",
            "touch-action": "none",
            transform: "translate(-50%, 50%)",
          }),
          tabindex: state.disabled || index !== state.focused ? "-1" : "0",
        };
      },
      bind: (el, part) => {
        const index = Number(part.props.index);
        part.api.points.set(index, el);
        return () => part.api.points.delete(index);
      },
      on: {
        // A double click removes the point.
        dblclick: (event, { api, props }) => {
          event.stopPropagation();
          api.removePoint(Number(props.index), event);
        },
        focus: (_event, { props, store }) =>
          store.set({ focused: Number(props.index) }),
        keydown: (event, { api, props, store }) => {
          if (store.get().disabled) {
            return;
          }
          const index = Number(props.index);
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            api.removePoint(index, event);
            return;
          }
          // The points share one tab stop: these keys move between them.
          const last = displayed(store.get()).length - 1;
          const move = {
            End: last,
            Home: 0,
            PageDown: Math.max(0, index - 1),
            PageUp: Math.min(last, index + 1),
          }[event.key];
          if (move !== undefined) {
            event.preventDefault();
            api.focusPoint(move);
            return;
          }
          if (api.keyPoint(index, event)) {
            event.preventDefault();
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          if (store.get().disabled || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const index = Number(props.index);
          // Alt and a click removes the point, as in a DAW's automation lane.
          if (event.altKey) {
            api.removePoint(index, event);
            return;
          }
          const graph = graphOf(el);
          if (!(el && graph)) {
            return;
          }
          el.focus({
            focusVisible: false,
            preventScroll: true,
          } as FocusOptions);
          store.set({ focused: index });
          api.pressPoint(index, event, el, graph);
        },
      },
      present: (state: EnvelopeState, { props }) =>
        Number(props.index) < displayed(state).length,
      // A formatter, read for its result: "callback" would make it an event in Vue.
      props: { getAriaValueText: "value", index: "key" },
      state: (state: EnvelopeState, { props }) =>
        pointState(state, Number(props.index)),
    }),
    root: slot<object, EnvelopePublicState>({
      attrs: (state: EnvelopeState) => ({
        ...stateAttrs(state),
        style: css({ position: "relative" }),
      }),
      state: (state: EnvelopeState) => publicState(state),
    }),
    segment: slot<SegmentProps, SegmentState>({
      attrs: (state: EnvelopeState, { props }) => {
        const index = Number(props.index);
        const value = displayed(state);
        const from = value[index];
        const to = value[index + 1];
        const current = segmentState(state, index);
        const midX = from && to ? (from.x + to.x) / 2 : 0;
        const midY = from && to ? levelAt(from, to, 0.5) : 0;
        return {
          ...stateAttrs(state),
          "aria-disabled": state.disabled || current.flat ? "true" : undefined,
          "aria-valuemax": "1",
          "aria-valuemin": "-1",
          "aria-valuenow": String(current.curve),
          "aria-valuetext": props.getAriaValueText
            ? props.getAriaValueText(current.curve, index)
            : String(Math.round(current.curve * 100) / 100),
          "data-curve": String(current.curve),
          "data-flat": flag(current.flat),
          "data-index": String(index),
          role: "slider",
          style: css({
            bottom: `${midY * 100}%`,
            left: `${midX * 100}%`,
            position: "absolute",
            "touch-action": "none",
            transform: "translate(-50%, 50%)",
          }),
          tabindex:
            state.disabled || index !== state.focusedSegment ? "-1" : "0",
        };
      },
      bind: (el, part) => {
        const index = Number(part.props.index);
        part.api.segments.set(index, el);
        return () => part.api.segments.delete(index);
      },
      on: {
        // A double click straightens the segment.
        dblclick: (event, { api, props }) => {
          event.stopPropagation();
          api.straightenSegment(Number(props.index), event);
        },
        focus: (_event, { props, store }) =>
          store.set({ focusedSegment: Number(props.index) }),
        keydown: (event, { api, props, store }) => {
          if (store.get().disabled) {
            return;
          }
          const index = Number(props.index);
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            api.focusSegment(index + (event.key === "ArrowRight" ? 1 : -1));
            return;
          }
          if (api.keySegment(index, event)) {
            event.preventDefault();
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          const index = Number(props.index);
          const { flat } = segmentState(store.get(), index);
          if (store.get().disabled || flat || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const graph = graphOf(el);
          if (!(el && graph)) {
            return;
          }
          el.focus({
            focusVisible: false,
            preventScroll: true,
          } as FocusOptions);
          store.set({ focusedSegment: index });
          api.pressSegment(index, event, el, graph);
        },
      },
      present: (state: EnvelopeState, { props }) =>
        Number(props.index) < displayed(state).length - 1,
      props: { getAriaValueText: "value", index: "key" },
      state: (state: EnvelopeState, { props }) =>
        segmentState(state, Number(props.index)),
    }),
  }),
  state: (options: EnvelopePrimitiveOptions): EnvelopeState => ({
    ...stateOf(options),
    blockedIndex: null,
    draft: null,
    draggingIndex: null,
    draggingSegmentIndex: null,
    focused: 0,
    focusedSegment: 0,
    isAddBlocked: false,
    value: options.value ?? options.defaultValue ?? DEFAULT_VALUE,
  }),
  // What the options give, not the tab stops the parts moved.
  sync: (options: EnvelopePrimitiveOptions) =>
    options.value === undefined
      ? stateOf(options)
      : { ...stateOf(options), value: options.value },
});
