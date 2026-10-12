import { followPointer } from "../../dom/gesture.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";
import { type PlotAxis, positionOn, valueOn } from "./axis.ts";

/** A point on the plot, in the axes' units. */
export interface PlotPoint {
  x: number;
  y: number;
}

/** The axes a handle moves along; the other keeps its value. */
export type PlotHandleAxis = "both" | "x" | "y";

export type PlotHandleChangeEventDetails =
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"input-change", Event>
  | ChangeEventDetails<"reset", Event>;
export type PlotHandleChangeEventReason =
  PlotHandleChangeEventDetails["reason"];
export type PlotHandleCommitEventDetails =
  | CommitEventDetails<"drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>
  | CommitEventDetails<"reset", Event>;
export type PlotHandleCommitEventReason =
  PlotHandleCommitEventDetails["reason"];

/** What an arrow key moves the handle by, as a share of the axis; Shift and Page Up/Down move ten times as far. */
const KEY_STEP = 0.01;
const LARGE_KEY_STEP = 0.1;
/** Shift slows a drag down to this share of the pointer's travel. */
const FINE_DRAG = 0.25;

export interface PlotHandleOptions {
  /** The axes the handle moves along. @default "both" */
  axis?: PlotHandleAxis;
  /** Uncontrolled starting value, and what a reset returns to. Defaults to the middle of the plot. */
  defaultValue?: PlotPoint;
  disabled?: boolean;
  /** The plot's box in the viewport. `fresh` reads it again, for the start of a gesture. */
  measure: (fresh: boolean) => DOMRect | null;
  onValueChange?: (
    value: PlotPoint,
    details: PlotHandleChangeEventDetails
  ) => void;
  onValueCommitted?: (
    value: PlotPoint,
    details: PlotHandleCommitEventDetails
  ) => void;
  /** The controlled value; leave it out for the handle to hold its own. */
  value?: PlotPoint;
  x: PlotAxis;
  y: PlotAxis;
}

/** What a view draws a handle from. */
export interface PlotHandleSnapshot {
  axis: PlotHandleAxis;
  disabled: boolean;
  /** Whether a pointer is dragging the handle. */
  dragging: boolean;
  /** Where the handle sits along each axis, 0…1. */
  position: PlotPoint;
  /** The value, clamped to both axes. */
  value: PlotPoint;
}

export interface PlotHandleController {
  getSnapshot: () => PlotHandleSnapshot;
  /** Handles a key on an axis input: arrows move a hundredth of the axis, Shift or Page Up/Down a tenth, Delete or Backspace reset. Returns `true` when the handle takes the key. */
  keyDown: (event: KeyboardEvent) => boolean;
  /**
   * Starts a pointer gesture on `element`: a drag moves the handle from where
   * it is (Shift makes it four times finer), and the drag follows the pointer
   * until it is released. An Alt + press resets it.
   */
  press: (event: PointerEvent, element: Element) => void;
  /** Returns to the default value, reporting a `"reset"` change and commit. */
  reset: (event: KeyboardEvent | MouseEvent | PointerEvent) => void;
  setOptions: (options: PlotHandleOptions) => void;
  subscribe: (listener: () => void) => () => void;
  /** Moves the handle along one axis to a position, 0…1, from an input. */
  typeAt: (along: "x" | "y", position: number, event: Event) => void;
}

/** `value` kept within both axes. */
function clampPoint(value: PlotPoint, x: PlotAxis, y: PlotAxis): PlotPoint {
  return {
    x: valueOn(x, positionOn(x, value.x)),
    y: valueOn(y, positionOn(y, value.y)),
  };
}

/** One drag, from press to release. */
interface PlotGesture {
  changed: boolean;
  fine: boolean;
  /** Where the handle was, as positions along each axis, when the drag began or Shift last changed. */
  origin: PlotPoint;
  pointerId: number;
  /** The plot's box when the press began: it does not move under a drag. */
  rect: DOMRect | null;
  start: { x: number; y: number };
}

/**
 * A handle's behavior with no view attached: its value, held or controlled,
 * every way of moving it, and what it looks like as a snapshot.
 */
export function createPlotHandleController(
  initial: PlotHandleOptions
): PlotHandleController {
  let options = initial;
  const moves = (along: "x" | "y") =>
    options.axis === undefined ||
    options.axis === "both" ||
    options.axis === along;

  // Held by the handle, unless `value` is given.
  let uncontrolled: PlotPoint | undefined;
  // The value as the gesture under way left it: a controlled value that lags
  // behind must not pull the handle back mid-drag. Reset on every render.
  let latest: PlotPoint | null = null;
  let dragging = false;
  let gesture: PlotGesture | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const defaultPoint = (): PlotPoint =>
    options.defaultValue ?? {
      x: valueOn(options.x, 0.5),
      y: valueOn(options.y, 0.5),
    };
  /** The value the props or the handle hold: what a view shows. */
  const held = (): PlotPoint =>
    clampPoint(
      options.value ?? uncontrolled ?? defaultPoint(),
      options.x,
      options.y
    );
  /** The value as the gesture under way left it. */
  const current = (): PlotPoint => latest ?? held();
  const positionOf = (point: PlotPoint): PlotPoint => ({
    x: positionOn(options.x, point.x),
    y: positionOn(options.y, point.y),
  });

  let snapshot: PlotHandleSnapshot | null = null;
  const getSnapshot = (): PlotHandleSnapshot => {
    const value = held();
    const axis = options.axis ?? "both";
    const disabled = options.disabled ?? false;
    const position = positionOf(value);
    if (
      snapshot &&
      snapshot.value.x === value.x &&
      snapshot.value.y === value.y &&
      snapshot.position.x === position.x &&
      snapshot.position.y === position.y &&
      snapshot.axis === axis &&
      snapshot.disabled === disabled &&
      snapshot.dragging === dragging
    ) {
      return snapshot;
    }
    snapshot = { axis, disabled, dragging, position, value };
    return snapshot;
  };

  /** Clamps and proposes a value; keeps it unless canceled. Returns `true` when the value is applied. */
  const change = (next: PlotPoint, details: PlotHandleChangeEventDetails) => {
    const clamped = clampPoint(next, options.x, options.y);
    const now = current();
    if (clamped.x === now.x && clamped.y === now.y) {
      return false;
    }
    options.onValueChange?.(clamped, details);
    if (details.isCanceled) {
      return false;
    }
    latest = clamped;
    if (options.value === undefined) {
      uncontrolled = clamped;
    }
    notify();
    return true;
  };

  /** Moves the handle to positions along each axis, 0…1, for the axes it moves along. */
  const moveTo = (
    position: PlotPoint,
    details: PlotHandleChangeEventDetails
  ) => {
    const now = current();
    return change(
      {
        x: moves("x") ? valueOn(options.x, position.x) : now.x,
        y: moves("y") ? valueOn(options.y, position.y) : now.y,
      },
      details
    );
  };

  const reset: PlotHandleController["reset"] = (event) => {
    if (options.disabled) {
      return;
    }
    const target = positionOf(clampPoint(defaultPoint(), options.x, options.y));
    if (moveTo(target, createChangeEventDetails("reset", event))) {
      options.onValueCommitted?.(current(), { event, reason: "reset" });
    }
  };

  const finish = (end: PointerEvent) => {
    const finished = gesture;
    gesture = null;
    // Read before settling: the value falls back to the known one after.
    const committed = current();
    dragging = false;
    notify();
    if (finished?.changed) {
      options.onValueCommitted?.(committed, {
        event: end,
        reason: "drag",
      });
    }
  };

  const press: PlotHandleController["press"] = (event, element) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    // An Alt + press returns to the default, as in a DAW.
    if (event.altKey) {
      reset(event);
      return;
    }
    element.setPointerCapture?.(event.pointerId);
    const started: PlotGesture = {
      changed: false,
      fine: event.shiftKey,
      origin: positionOf(current()),
      pointerId: event.pointerId,
      rect: options.measure(true),
      start: { x: event.clientX, y: event.clientY },
    };
    gesture = started;
    dragging = true;
    notify();
    followPointer(
      element,
      event.pointerId,
      (move) => {
        const { rect } = started;
        if (!rect) {
          return;
        }
        // Shift pressed or let go mid-drag: carry on from here at the new speed.
        if (move.shiftKey !== started.fine) {
          started.fine = move.shiftKey;
          started.origin = positionOf(current());
          started.start = { x: move.clientX, y: move.clientY };
        }
        const speed = started.fine ? FINE_DRAG : 1;
        const along = {
          x:
            started.origin.x +
            ((move.clientX - started.start.x) / Math.max(rect.width, 1)) *
              speed,
          y:
            started.origin.y -
            ((move.clientY - started.start.y) / Math.max(rect.height, 1)) *
              speed,
        };
        if (moveTo(along, createChangeEventDetails("drag", move))) {
          started.changed = true;
        }
      },
      finish
    );
  };

  const keyDown: PlotHandleController["keyDown"] = (event) => {
    if (options.disabled) {
      return false;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      reset(event);
      return true;
    }
    const step = event.shiftKey ? LARGE_KEY_STEP : KEY_STEP;
    const at = positionOf(current());
    // Home and End go to the ends of the axis the handle moves along first.
    const ends = moves("x") ? "x" : "y";
    const targets: Record<string, PlotPoint> = {
      ArrowDown: { x: at.x, y: at.y - step },
      ArrowLeft: { x: at.x - step, y: at.y },
      ArrowRight: { x: at.x + step, y: at.y },
      ArrowUp: { x: at.x, y: at.y + step },
      End: { ...at, [ends]: 1 },
      Home: { ...at, [ends]: 0 },
      PageDown: { x: at.x, y: at.y - LARGE_KEY_STEP },
      PageUp: { x: at.x, y: at.y + LARGE_KEY_STEP },
    };
    const target = targets[event.key];
    if (!target) {
      return false;
    }
    if (moveTo(target, createChangeEventDetails("keyboard", event))) {
      options.onValueCommitted?.(current(), {
        event,
        reason: "keyboard",
      });
    }
    return true;
  };

  const typeAt: PlotHandleController["typeAt"] = (along, position, event) => {
    const at = positionOf(current());
    if (
      moveTo(
        { ...at, [along]: position },
        createChangeEventDetails("input-change", event)
      )
    ) {
      options.onValueCommitted?.(current(), {
        event,
        reason: "input-change",
      });
    }
  };

  return {
    getSnapshot,
    keyDown,
    press,
    reset,
    setOptions: (next) => {
      options = next;
      // The props take over again on every render.
      latest = null;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    typeAt,
  };
}
