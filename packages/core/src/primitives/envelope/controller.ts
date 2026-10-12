import { isReleased } from "../../dom/pointer";
import { clamp } from "../../shared/math";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events";
import { createPairFormatter } from "../../value/format";
import {
  type Breakpoint,
  CURVE_EPSILON,
  clampToNeighbors,
  curveForMidpoint,
  curveKeyDelta,
  insertPoint,
  LARGE_STEP_MULTIPLIER,
  levelAt,
  samePoints,
  sanitizePoints,
  segmentNear,
  snapTo,
} from "./geometry";

/** With Shift held a drag moves this share of the pointer's distance. */
const FINE_RATIO = 0.25;
/** How long a blocked-action signal stays on, long enough for a feedback animation to play. */
const BLOCKED_DURATION_MS = 320;
const DEFAULT_MIN_POINTS = 2;
const DEFAULT_STEP = 0.01;
/** ADSR-shaped: attack to peak, decay to a sustain plateau, release, reads as an envelope rather than a bare triangle. */
const DEFAULT_VALUE: Breakpoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

export type EnvelopeIndexed<T> = T & { index: number };

export type EnvelopeChangeEventDetails = EnvelopeIndexed<
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"add", MouseEvent>
  | ChangeEventDetails<"remove", MouseEvent | KeyboardEvent>
  | ChangeEventDetails<"curve", PointerEvent | KeyboardEvent | MouseEvent>
>;
export type EnvelopeChangeEventReason = EnvelopeChangeEventDetails["reason"];
export type EnvelopeCommitEventDetails = EnvelopeIndexed<
  | CommitEventDetails<"drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"add", MouseEvent>
  | CommitEventDetails<"remove", MouseEvent | KeyboardEvent>
  | CommitEventDetails<"curve", PointerEvent | KeyboardEvent | MouseEvent>
>;
export type EnvelopeCommitEventReason = EnvelopeCommitEventDetails["reason"];

export interface EnvelopeOptions {
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
  onValueChange?: (
    value: Breakpoint[],
    details: EnvelopeChangeEventDetails
  ) => void;
  onValueCommitted?: (
    value: Breakpoint[],
    details: EnvelopeCommitEventDetails
  ) => void;
  /** Grid points snap to, in normalized units; 0 is no grid. @default 0 */
  snap?: number;
  /** Keyboard step on both axes, in normalized units. @default 0.01 */
  step?: number;
  /** The controlled points; leave it out for the envelope to hold its own. */
  value?: Breakpoint[];
}

/** What a view draws an envelope from. */
export interface EnvelopeSnapshot {
  /** The point whose removal was just refused, for a short feedback signal. */
  blockedIndex: number | null;
  disabled: boolean;
  /** Whether a point or a segment is being dragged. */
  dragging: boolean;
  /** The point being dragged, if any. */
  draggingIndex: number | null;
  /** The segment being bent, if any. */
  draggingSegmentIndex: number | null;
  /** Whether an addition was just refused, for a short feedback signal. */
  isAddBlocked: boolean;
  minPoints: number;
  snap: number;
  step: number;
  /** The points as displayed: the dragged ones while a pointer moves them. */
  value: Breakpoint[];
}

export interface EnvelopeController {
  /** Adds a point at `at` (normalized 0…1), snapped unless Cmd/Ctrl is held; blocked at `maxPoints`. Returns the new index, or null. */
  addPointAt: (
    at: { x: number; y: number },
    event: MouseEvent
  ) => number | null;
  /** Releases the feedback timers; call it when the view goes away. */
  dispose: () => void;
  /** Formats a point's `x` and `y` as one string. */
  formatPoint: (x: number, y: number) => string;
  getSnapshot: () => EnvelopeSnapshot;
  /** Handles a key on a point's handle: arrows move it, Delete or Backspace removes it. Returns whether the key was the point's. */
  keyPoint: (index: number, event: KeyboardEvent) => boolean;
  /** Handles a key on a segment's handle: Up and Down bend it, Delete or Backspace straightens it. Returns whether the key was the segment's. */
  keySegment: (index: number, event: KeyboardEvent) => boolean;
  /** Starts an Alt + press on the graph: a drag bends the segment under the pointer. */
  pressBend: (event: PointerEvent, graph: Element) => void;
  /** Starts a press on a point's handle: a drag moves it, Alt removes it. */
  pressPoint: (
    index: number,
    event: PointerEvent,
    handle: Element,
    graph: Element
  ) => void;
  /** Starts a press on a segment's handle: a drag bends it. */
  pressSegment: (
    index: number,
    event: PointerEvent,
    handle: Element,
    graph: Element
  ) => void;
  /** Removes a point; blocked at `minPoints`. Returns whether it was removed. */
  removePoint: (index: number, event: MouseEvent | KeyboardEvent) => boolean;
  setOptions: (options: EnvelopeOptions) => void;
  /** Straightens the segment under `at`, if there is one. */
  straightenAt: (at: { x: number; y: number }, event: MouseEvent) => void;
  /** Straightens a segment, as a double click or Delete on its handle does. */
  straightenSegment: (index: number, event: MouseEvent | KeyboardEvent) => void;
  subscribe: (listener: () => void) => () => void;
}

/** One pointer gesture, from press to release. */
type EnvelopeGesture =
  | {
      changed: boolean;
      /** While Shift is held: where the pointer and the point were when it went down. */
      fine: { pointer: { x: number; y: number }; point: Breakpoint } | null;
      index: number;
      kind: "point";
      pointerId: number;
    }
  | {
      changed: boolean;
      index: number;
      kind: "segment";
      pointerId: number;
    }
  | {
      changed: boolean;
      index: number;
      kind: "bend";
      pointerId: number;
      /** Where the segment's midpoint was, and where the pointer was, when the press began. */
      startLevel: number;
      startY: number;
    };

/**
 * An envelope's behavior with no view attached: its points, held or
 * controlled, every way of moving, adding, removing and bending them, and what
 * it looks like as a snapshot.
 */
export function createEnvelopeController(
  initial: EnvelopeOptions = {}
): EnvelopeController {
  let options = initial;
  const bounds = () => ({
    maxPoints: options.maxPoints ?? Number.POSITIVE_INFINITY,
    minPoints: options.minPoints ?? DEFAULT_MIN_POINTS,
    snap: options.snap ?? 0,
    step: options.step ?? DEFAULT_STEP,
  });

  // Read on first use, so the `defaultValue` a view passes after creation counts.
  let uncontrolled: Breakpoint[] | undefined;
  // Holds the dragged points until the pointer is released, so a controlled
  // value that lags behind can't pull the envelope back mid-drag.
  let dragValue: Breakpoint[] | null = null;
  let draggingIndex: number | null = null;
  let draggingSegmentIndex: number | null = null;
  let blockedIndex: number | null = null;
  let isAddBlocked = false;
  let gesture: EnvelopeGesture | null = null;
  let blockedTimer: ReturnType<typeof setTimeout> | undefined;
  let addBlockedTimer: ReturnType<typeof setTimeout> | undefined;
  let blockedFrame: number | undefined;
  let addBlockedFrame: number | undefined;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };
  const isDragging = () =>
    draggingIndex !== null || draggingSegmentIndex !== null;

  let formatter: Intl.NumberFormat | null = null;
  let formatKey: unknown[] = [];
  const formatPoint = (x: number, y: number) => {
    if (
      !formatter ||
      formatKey[0] !== options.locale ||
      formatKey[1] !== options.format
    ) {
      formatter = new Intl.NumberFormat(options.locale, options.format);
      formatKey = [options.locale, options.format];
    }
    return createPairFormatter(formatter)(x, y);
  };

  const displayed = (): Breakpoint[] => {
    if (dragValue) {
      return dragValue;
    }
    const held =
      options.value ?? uncontrolled ?? options.defaultValue ?? DEFAULT_VALUE;
    return sanitizePoints(held);
  };

  let snapshot: EnvelopeSnapshot | null = null;
  const getSnapshot = (): EnvelopeSnapshot => {
    const bound = bounds();
    const value = displayed();
    const disabled = options.disabled ?? false;
    if (
      snapshot &&
      samePoints(snapshot.value, value) &&
      snapshot.dragging === isDragging() &&
      snapshot.disabled === disabled &&
      snapshot.draggingIndex === draggingIndex &&
      snapshot.draggingSegmentIndex === draggingSegmentIndex &&
      snapshot.blockedIndex === blockedIndex &&
      snapshot.isAddBlocked === isAddBlocked &&
      snapshot.minPoints === bound.minPoints &&
      snapshot.snap === bound.snap &&
      snapshot.step === bound.step
    ) {
      return snapshot;
    }
    snapshot = {
      blockedIndex,
      disabled,
      dragging: isDragging(),
      draggingIndex,
      draggingSegmentIndex,
      isAddBlocked,
      minPoints: bound.minPoints,
      snap: bound.snap,
      step: bound.step,
      value,
    };
    return snapshot;
  };

  /** Reports a change; keeps it unless it was canceled, and says which. */
  const change = (next: Breakpoint[], details: EnvelopeChangeEventDetails) => {
    if (samePoints(next, displayed())) {
      return false;
    }
    options.onValueChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    if (options.value === undefined) {
      uncontrolled = next;
    } else if (isDragging()) {
      dragValue = next;
    }
    notify();
    return true;
  };
  const commit = (next: Breakpoint[], details: EnvelopeCommitEventDetails) => {
    options.onValueCommitted?.(next, details);
  };
  const indexed = (
    details: ReturnType<typeof createChangeEventDetails>,
    index: number
  ) => Object.assign(details, { index }) as EnvelopeChangeEventDetails;

  /** Moves one point, clamped between its neighbors; returns the points applied, or null. */
  const movePoint = (
    index: number,
    target: { x: number; y: number },
    details: EnvelopeChangeEventDetails
  ): Breakpoint[] | null => {
    const base = displayed();
    const clamped = clampToNeighbors(base, index, target);
    if (!clamped) {
      return null;
    }
    const next = [...base];
    next[index] = { ...base[index], ...clamped };
    return change(next, details) ? next : null;
  };

  /** Bends the segment leaving a point; returns the points applied, or null. */
  const setCurve = (
    index: number,
    curve: number,
    details: EnvelopeChangeEventDetails
  ): Breakpoint[] | null => {
    const base = displayed();
    const point = base[index];
    if (!(point && base[index + 1])) {
      return null;
    }
    const { curve: _previous, ...rest } = point;
    const bent = clamp(curve, -1, 1);
    const next = [...base];
    next[index] =
      Math.abs(bent) < CURVE_EPSILON ? rest : { ...rest, curve: bent };
    return change(next, details) ? next : null;
  };

  const signalBlockedPoint = (index: number) => {
    clearTimeout(blockedTimer);
    blockedIndex = null;
    notify();
    cancelAnimationFrame(blockedFrame ?? 0);
    // Cleared, then set on the next frame, so a feedback animation replays
    // even when the same removal is refused twice in a row.
    blockedFrame = requestAnimationFrame(() => {
      blockedIndex = index;
      notify();
      blockedTimer = setTimeout(() => {
        blockedIndex = null;
        notify();
      }, BLOCKED_DURATION_MS);
    });
  };

  const signalAddBlocked = () => {
    clearTimeout(addBlockedTimer);
    isAddBlocked = false;
    notify();
    cancelAnimationFrame(addBlockedFrame ?? 0);
    addBlockedFrame = requestAnimationFrame(() => {
      isAddBlocked = true;
      notify();
      addBlockedTimer = setTimeout(() => {
        isAddBlocked = false;
        notify();
      }, BLOCKED_DURATION_MS);
    });
  };

  const addPointAt: EnvelopeController["addPointAt"] = (at, event) => {
    if (options.disabled) {
      return null;
    }
    const { maxPoints, snap } = bounds();
    const base = displayed();
    if (base.length >= maxPoints) {
      signalAddBlocked();
      return null;
    }
    const free = event.metaKey || event.ctrlKey;
    const grid = free ? 0 : snap;
    const { index, value: next } = insertPoint(base, {
      x: snapTo(at.x, grid),
      y: snapTo(at.y, grid),
    });
    if (change(next, indexed(createChangeEventDetails("add", event), index))) {
      commit(next, { event, index, reason: "add" });
      return index;
    }
    return null;
  };

  const removePoint: EnvelopeController["removePoint"] = (index, event) => {
    if (options.disabled) {
      return false;
    }
    const base = displayed();
    if (base.length <= bounds().minPoints) {
      signalBlockedPoint(index);
      return false;
    }
    const next = base.filter((_, i) => i !== index);
    if (
      change(next, indexed(createChangeEventDetails("remove", event), index))
    ) {
      commit(next, { event, index, reason: "remove" });
      return true;
    }
    return false;
  };

  const straightenSegment: EnvelopeController["straightenSegment"] = (
    index,
    event
  ) => {
    if (options.disabled) {
      return;
    }
    const applied = setCurve(
      index,
      0,
      indexed(createChangeEventDetails("curve", event), index)
    );
    if (applied) {
      commit(applied, { event, index, reason: "curve" });
    }
  };

  const straightenAt: EnvelopeController["straightenAt"] = (at, event) => {
    const index = segmentNear(displayed(), at.x, at.y);
    if (index !== null) {
      straightenSegment(index, event);
    }
  };

  /** Ends the drag in progress, committing it if it changed the points. */
  const finish = (
    end: PointerEvent,
    reason: "drag" | "curve",
    index: number
  ) => {
    const current = gesture;
    gesture = null;
    draggingIndex = null;
    draggingSegmentIndex = null;
    const settled = displayed();
    dragValue = null;
    notify();
    if (current?.changed) {
      commit(settled, { event: end, index, reason });
    }
  };

  /** Listens to one pointer on the document until it is released, then ends its gesture. */
  const listen = (
    handle: Element,
    pointerId: number,
    move: (event: PointerEvent) => void,
    end: (event: PointerEvent) => void
  ) => {
    const drag = new AbortController();
    const { signal } = drag;
    const doc = handle.ownerDocument;
    doc.addEventListener(
      "pointermove",
      (event: PointerEvent) => {
        if (event.pointerId !== pointerId) {
          return;
        }
        if (isReleased(event)) {
          drag.abort();
          end(event);
          return;
        }
        move(event);
      },
      { signal }
    );
    const release = (event: PointerEvent) => {
      if (event.pointerId === pointerId) {
        drag.abort();
        end(event);
      }
    };
    doc.addEventListener("pointerup", release, { signal });
    doc.addEventListener("pointercancel", release, { signal });
  };

  const pointerAt = (graph: Element, event: PointerEvent) => {
    const rect = graph.getBoundingClientRect();
    return {
      rect,
      x: (event.clientX - rect.left) / Math.max(rect.width, 1),
      y: 1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
    };
  };

  const pressPoint: EnvelopeController["pressPoint"] = (
    index,
    event,
    handle,
    graph
  ) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    // Alt + press removes the point, as in a DAW's automation lane.
    if (event.altKey) {
      removePoint(index, event);
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const started = {
      changed: false,
      fine: null as {
        pointer: { x: number; y: number };
        point: Breakpoint;
      } | null,
      index,
      kind: "point" as const,
      pointerId: event.pointerId,
    };
    gesture = started;
    draggingIndex = index;
    notify();
    listen(
      handle,
      event.pointerId,
      (move) => {
        const rect = graph.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }
        const pointer = pointerAt(graph, move);
        const { snap } = bounds();
        let target = { x: pointer.x, y: pointer.y };
        if (move.shiftKey) {
          started.fine ??= {
            point: displayed()[index] ?? target,
            pointer: { x: pointer.x, y: pointer.y },
          };
          const { fine } = started;
          target = {
            x: fine.point.x + (pointer.x - fine.pointer.x) * FINE_RATIO,
            y: fine.point.y + (pointer.y - fine.pointer.y) * FINE_RATIO,
          };
        } else {
          started.fine = null;
          if (snap > 0 && !(move.metaKey || move.ctrlKey)) {
            target = { x: snapTo(pointer.x, snap), y: snapTo(pointer.y, snap) };
          }
        }
        if (
          movePoint(
            index,
            target,
            indexed(createChangeEventDetails("drag", move), index)
          )
        ) {
          started.changed = true;
        }
      },
      (end) => {
        if (gesture?.kind === "point" && gesture.pointerId === end.pointerId) {
          finish(end, "drag", index);
        }
      }
    );
  };

  const pressSegment: EnvelopeController["pressSegment"] = (
    index,
    event,
    handle,
    graph
  ) => {
    const from = displayed()[index];
    const to = displayed()[index + 1];
    const flat = from && to ? Math.abs(to.y - from.y) < 1e-6 : true;
    if (options.disabled || flat || event.button !== 0) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const started = {
      changed: false,
      index,
      kind: "segment" as const,
      pointerId: event.pointerId,
    };
    gesture = started;
    draggingSegmentIndex = index;
    notify();
    listen(
      handle,
      event.pointerId,
      (move) => {
        const left = displayed()[index];
        const right = displayed()[index + 1];
        const rect = graph.getBoundingClientRect();
        if (!(left && right) || rect.height <= 0) {
          return;
        }
        const next = curveForMidpoint(
          left,
          right,
          1 - (move.clientY - rect.top) / rect.height
        );
        if (
          next !== null &&
          setCurve(
            index,
            next,
            indexed(createChangeEventDetails("curve", move), index)
          )
        ) {
          started.changed = true;
        }
      },
      (end) => {
        if (
          gesture?.kind === "segment" &&
          gesture.pointerId === end.pointerId
        ) {
          finish(end, "curve", index);
        }
      }
    );
  };

  const pressBend: EnvelopeController["pressBend"] = (event, graph) => {
    if (options.disabled || event.button !== 0 || !event.altKey) {
      return;
    }
    const at = pointerAt(graph, event);
    const index = segmentNear(displayed(), at.x, at.y);
    const from = displayed()[index ?? 0];
    const to = displayed()[(index ?? 0) + 1];
    if (index === null || !(from && to)) {
      return;
    }
    graph.setPointerCapture?.(event.pointerId);
    const started = {
      changed: false,
      index,
      kind: "bend" as const,
      pointerId: event.pointerId,
      startLevel: levelAt(from, to, 0.5),
      startY: event.clientY,
    };
    gesture = started;
    draggingSegmentIndex = index;
    notify();
    listen(
      graph,
      event.pointerId,
      (move) => {
        const left = displayed()[index];
        const right = displayed()[index + 1];
        const rect = graph.getBoundingClientRect();
        if (rect.height <= 0 || !(left && right)) {
          return;
        }
        const level =
          started.startLevel + (started.startY - move.clientY) / rect.height;
        const curve = curveForMidpoint(left, right, level);
        if (
          curve !== null &&
          setCurve(
            index,
            curve,
            indexed(createChangeEventDetails("curve", move), index)
          )
        ) {
          started.changed = true;
        }
      },
      (end) => {
        if (gesture?.kind === "bend" && gesture.pointerId === end.pointerId) {
          finish(end, "curve", index);
        }
      }
    );
  };

  const keyPoint: EnvelopeController["keyPoint"] = (index, event) => {
    const current = displayed()[index];
    if (options.disabled || !current) {
      return false;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      removePoint(index, event);
      return true;
    }
    const distance =
      bounds().step * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
    const targets: Record<string, { x: number; y: number }> = {
      ArrowDown: { x: current.x, y: current.y - distance },
      ArrowLeft: { x: current.x - distance, y: current.y },
      ArrowRight: { x: current.x + distance, y: current.y },
      ArrowUp: { x: current.x, y: current.y + distance },
    };
    const target = targets[event.key];
    if (!target) {
      return false;
    }
    const applied = movePoint(
      index,
      target,
      indexed(createChangeEventDetails("keyboard", event), index)
    );
    if (applied) {
      commit(applied, { event, index, reason: "keyboard" });
    }
    return true;
  };

  const keySegment: EnvelopeController["keySegment"] = (index, event) => {
    const left = displayed()[index];
    const right = displayed()[index + 1];
    if (options.disabled || !(left && right)) {
      return false;
    }
    const flat = Math.abs(right.y - left.y) < 1e-6;
    if (flat) {
      return false;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      straightenSegment(index, event);
      return true;
    }
    const delta = curveKeyDelta(event, left, right, bounds().step);
    if (delta === null) {
      return false;
    }
    const applied = setCurve(
      index,
      (left.curve ?? 0) + delta,
      indexed(createChangeEventDetails("curve", event), index)
    );
    if (applied) {
      commit(applied, { event, index, reason: "curve" });
    }
    return true;
  };

  return {
    addPointAt,
    dispose: () => {
      clearTimeout(blockedTimer);
      clearTimeout(addBlockedTimer);
      cancelAnimationFrame(blockedFrame ?? 0);
      cancelAnimationFrame(addBlockedFrame ?? 0);
    },
    formatPoint,
    getSnapshot,
    keyPoint,
    keySegment,
    pressBend,
    pressPoint,
    pressSegment,
    removePoint,
    setOptions: (next) => {
      options = next;
    },
    straightenAt,
    straightenSegment,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
