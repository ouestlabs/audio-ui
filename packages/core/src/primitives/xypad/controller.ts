import { isReleased } from "../../dom/pointer.js";
import { clamp, clampFinite, roundToStep } from "../../shared/math.js";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.js";
import { createPairFormatter } from "../../value/format.js";
import { type Axis, LARGE_STEP_MULTIPLIER, toPercent } from "./shared.js";

export interface XYPadPoint {
  x: number;
  y: number;
}

export type XYPadChangeEventDetails =
  | ChangeEventDetails<"press" | "drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"wheel", WheelEvent>
  | ChangeEventDetails<"reset", KeyboardEvent | MouseEvent | PointerEvent>
  | ChangeEventDetails<"input-change", Event>;
export type XYPadChangeEventReason = XYPadChangeEventDetails["reason"];
export type XYPadCommitEventDetails =
  | CommitEventDetails<"press" | "drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"wheel", WheelEvent>
  | CommitEventDetails<"reset", KeyboardEvent | MouseEvent | PointerEvent>
  | CommitEventDetails<"input-change", Event>;
export type XYPadCommitEventReason = XYPadCommitEventDetails["reason"];

export interface XYPadOptions {
  /** Uncontrolled starting point, and what a reset returns to; defaults to the center of the pad. */
  defaultValue?: XYPadPoint;
  disabled?: boolean;
  /** How each axis is written, e.g. `{ maximumFractionDigits: 1 }`. */
  format?: Intl.NumberFormatOptions;
  locale?: Intl.LocalesArgument;
  /** @default 100 */
  maxX?: number;
  /** @default 100 */
  maxY?: number;
  /** @default 0 */
  minX?: number;
  /** @default 0 */
  minY?: number;
  onValueChange?: (value: XYPadPoint, details: XYPadChangeEventDetails) => void;
  onValueCommitted?: (
    value: XYPadPoint,
    details: XYPadCommitEventDetails
  ) => void;
  /** @default 1 */
  stepX?: number;
  /** @default 1 */
  stepY?: number;
  /** The controlled point; leave it out for the pad to hold its own. */
  value?: XYPadPoint;
}

/** What a view draws a pad from. */
export interface XYPadSnapshot {
  disabled: boolean;
  /** Whether a pointer is moving the point. */
  dragging: boolean;
  /** Each axis as text, with `format` and `locale`. */
  formatted: { x: string; y: string };
  /** Both axes as one text, with the separator of the locale. */
  formattedPair: string;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  /** Point position, 0…1 from the left. */
  percentX: number;
  /** Point position, 0…1 from the bottom. */
  percentY: number;
  stepX: number;
  stepY: number;
  /** The point as displayed: the dragged one while a pointer moves it. */
  value: XYPadPoint;
}

export interface XYPadController {
  /** Listens to wheel and trackpad scrolling on `element`; returns what removes the listener. */
  attachWheel: (element: HTMLElement) => () => void;
  getSnapshot: () => XYPadSnapshot;
  /**
   * Handles a key on one of the pad's inputs: arrows move by a step (Shift
   * for ten), Page Up/Down move the y axis by ten steps, Home and End go to
   * the ends of x, Delete or Backspace reset. Returns `true` when the pad
   * takes the key, so the caller can prevent its default.
   */
  keyDown: (event: KeyboardEvent) => boolean;
  /**
   * Starts a pointer gesture on `control`: a press moves the point under the
   * pointer, and a drag follows it on the document until it is released. An
   * Alt + press resets it.
   */
  press: (event: PointerEvent, control: HTMLElement) => void;
  /** Returns to the default point, reporting a `"reset"` change and commit. */
  reset: (event: KeyboardEvent | MouseEvent | PointerEvent) => void;
  /** Takes the latest options; call it whenever they may have changed. */
  setOptions: (options: XYPadOptions) => void;
  subscribe: (listener: () => void) => () => void;
  /** Sets one axis to a typed value, on the grid, reporting an `"input-change"` change and commit. */
  type: (axis: Axis, typed: number, event: Event) => void;
}

/** One pointer gesture, from press to release. */
interface XYPadGesture {
  /** Whether the gesture changed the value at least once; if so its end commits, even back on the start value. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  pointerId: number;
  rect: DOMRect;
}

/**
 * A pad's behavior with no view attached: its point, held or controlled,
 * every way of moving it, and what it looks like as a snapshot.
 */
export function createXYPadController(
  initial: XYPadOptions = {}
): XYPadController {
  let options = initial;
  const bounds = () => ({
    maxX: options.maxX ?? 100,
    maxY: options.maxY ?? 100,
    minX: options.minX ?? 0,
    minY: options.minY ?? 0,
    stepX: options.stepX ?? 1,
    stepY: options.stepY ?? 1,
  });
  const resetValue = (): XYPadPoint => {
    const { maxX, maxY, minX, minY } = bounds();
    return (
      options.defaultValue ?? {
        x: minX + (maxX - minX) / 2,
        y: minY + (maxY - minY) / 2,
      }
    );
  };

  // Read on first use, so the `defaultValue` a view passes after creation counts.
  let uncontrolled: XYPadPoint | undefined;
  // Holds the dragged point until the pointer is released, so a controlled
  // point that lags behind can't pull the pad back mid-drag.
  let dragValue: XYPadPoint | null = null;
  let dragging = false;
  let gesture: XYPadGesture | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  let formatter: Intl.NumberFormat | null = null;
  let formatKey: unknown[] = [];
  const format = () => {
    if (
      !formatter ||
      formatKey[0] !== options.locale ||
      formatKey[1] !== options.format
    ) {
      formatter = new Intl.NumberFormat(options.locale, options.format);
      formatKey = [options.locale, options.format];
    }
    return formatter;
  };

  const displayed = (): XYPadPoint => {
    const { maxX, maxY, minX, minY } = bounds();
    if (dragValue) {
      return dragValue;
    }
    const held =
      options.value === undefined
        ? (uncontrolled ?? resetValue())
        : options.value;
    return {
      x: clampFinite(held.x, minX, maxX),
      y: clampFinite(held.y, minY, maxY),
    };
  };
  /** Snaps and clamps both axes to the grid. */
  const onGrid = (raw: XYPadPoint): XYPadPoint => {
    const { maxX, maxY, minX, minY, stepX, stepY } = bounds();
    return {
      x: clamp(roundToStep(raw.x, stepX, minX), minX, maxX),
      y: clamp(roundToStep(raw.y, stepY, minY), minY, maxY),
    };
  };

  let snapshot: XYPadSnapshot | null = null;
  const getSnapshot = (): XYPadSnapshot => {
    const bound = bounds();
    const value = displayed();
    const { disabled = false } = options;
    const numberFormat = format();
    const formatted = {
      x: numberFormat.format(value.x),
      y: numberFormat.format(value.y),
    };
    const formattedPair = createPairFormatter(numberFormat)(value.x, value.y);
    if (
      snapshot &&
      snapshot.value.x === value.x &&
      snapshot.value.y === value.y &&
      snapshot.dragging === dragging &&
      snapshot.disabled === disabled &&
      snapshot.minX === bound.minX &&
      snapshot.maxX === bound.maxX &&
      snapshot.minY === bound.minY &&
      snapshot.maxY === bound.maxY &&
      snapshot.stepX === bound.stepX &&
      snapshot.stepY === bound.stepY &&
      snapshot.formattedPair === formattedPair &&
      snapshot.formatted.x === formatted.x &&
      snapshot.formatted.y === formatted.y
    ) {
      return snapshot;
    }
    snapshot = {
      disabled,
      dragging,
      formatted,
      formattedPair,
      maxX: bound.maxX,
      maxY: bound.maxY,
      minX: bound.minX,
      minY: bound.minY,
      percentX: toPercent(value.x, bound.minX, bound.maxX),
      percentY: toPercent(value.y, bound.minY, bound.maxY),
      stepX: bound.stepX,
      stepY: bound.stepY,
      value,
    };
    return snapshot;
  };

  /** Reports a change; keeps it unless it was canceled, and says which. */
  const change = (raw: XYPadPoint, details: XYPadChangeEventDetails) => {
    const next = onGrid(raw);
    const current = displayed();
    if (next.x === current.x && next.y === current.y) {
      return false;
    }
    options.onValueChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    if (options.value === undefined) {
      uncontrolled = next;
    } else if (dragging) {
      dragValue = next;
    }
    notify();
    return true;
  };
  const commit = (next: XYPadPoint, details: XYPadCommitEventDetails) => {
    options.onValueCommitted?.(next, details);
  };
  /** A change that is over as soon as it is made: keys, typed values, the wheel, a reset. */
  const setAtOnce = (
    next: XYPadPoint,
    reason: Exclude<XYPadChangeEventReason, "press" | "drag">,
    event: Event
  ) => {
    const details = createChangeEventDetails(
      reason,
      event
    ) as XYPadChangeEventDetails;
    if (change(next, details)) {
      commit(onGrid(next), { event, reason } as XYPadCommitEventDetails);
    }
  };

  /** The point under a pointer, in the pad's rectangle at the press. */
  const valueAt = (current: XYPadGesture, x: number, y: number): XYPadPoint => {
    const { maxX, maxY, minX, minY } = bounds();
    const { rect } = current;
    const fromLeft = clamp((x - rect.left) / Math.max(rect.width, 1), 0, 1);
    const fromBottom = clamp(
      (rect.bottom - y) / Math.max(rect.height, 1),
      0,
      1
    );
    return {
      x: minX + fromLeft * (maxX - minX),
      y: minY + fromBottom * (maxY - minY),
    };
  };

  /** Ends the gesture, committing it if it changed the point. */
  const finish = (end: PointerEvent) => {
    if (!gesture) {
      return;
    }
    const current = gesture;
    gesture = null;
    dragging = false;
    const settled = displayed();
    dragValue = null;
    notify();
    if (current.changed) {
      commit(settled, {
        event: end,
        reason: current.moved ? "drag" : "press",
      } as XYPadCommitEventDetails);
    }
  };

  const press: XYPadController["press"] = (event, control) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    // Alt + press returns to the default, as in a DAW.
    if (event.altKey) {
      setAtOnce(resetValue(), "reset", event);
      return;
    }
    control.setPointerCapture?.(event.pointerId);
    const started: XYPadGesture = {
      changed: false,
      moved: false,
      pointerId: event.pointerId,
      rect: control.getBoundingClientRect(),
    };
    gesture = started;
    dragging = true;
    notify();
    started.changed = change(
      valueAt(started, event.clientX, event.clientY),
      createChangeEventDetails("press", event) as XYPadChangeEventDetails
    );

    const drag = new AbortController();
    const doc = control.ownerDocument;
    const { signal } = drag;
    doc.addEventListener(
      "pointermove",
      (moveEvent: PointerEvent) => {
        if (!gesture || moveEvent.pointerId !== started.pointerId) {
          return;
        }
        if (isReleased(moveEvent)) {
          drag.abort();
          finish(moveEvent);
          return;
        }
        started.moved = true;
        if (
          change(
            valueAt(started, moveEvent.clientX, moveEvent.clientY),
            createChangeEventDetails(
              "drag",
              moveEvent
            ) as XYPadChangeEventDetails
          )
        ) {
          started.changed = true;
        }
      },
      { signal }
    );
    const release = (endEvent: PointerEvent) => {
      if (!gesture || endEvent.pointerId !== started.pointerId) {
        return;
      }
      drag.abort();
      finish(endEvent);
    };
    doc.addEventListener("pointerup", release, { signal });
    doc.addEventListener("pointercancel", release, { signal });
  };

  const keyDown: XYPadController["keyDown"] = (event) => {
    if (options.disabled) {
      return false;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      setAtOnce(resetValue(), "reset", event);
      return true;
    }
    const { maxX, minX, stepX, stepY } = bounds();
    const current = displayed();
    const multiplier = event.shiftKey ? LARGE_STEP_MULTIPLIER : 1;
    const dx = stepX * multiplier;
    const dy = stepY * multiplier;
    const largeDy = stepY * LARGE_STEP_MULTIPLIER;
    const targets: Record<string, XYPadPoint> = {
      ArrowDown: { x: current.x, y: current.y - dy },
      ArrowLeft: { x: current.x - dx, y: current.y },
      ArrowRight: { x: current.x + dx, y: current.y },
      ArrowUp: { x: current.x, y: current.y + dy },
      End: { x: maxX, y: current.y },
      Home: { x: minX, y: current.y },
      PageDown: { x: current.x, y: current.y - largeDy },
      PageUp: { x: current.x, y: current.y + largeDy },
    };
    const target = targets[event.key];
    if (!target) {
      return false;
    }
    setAtOnce(target, "keyboard", event);
    return true;
  };

  const attachWheel: XYPadController["attachWheel"] = (element) => {
    const handle = (event: WheelEvent) => {
      if (options.disabled || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      const { maxX, maxY, minX, minY } = bounds();
      const rect = element.getBoundingClientRect();
      const current = displayed();
      // Trackpads scroll in two dimensions: the wheel moves the point by the
      // same distance a drag would.
      setAtOnce(
        {
          x:
            current.x +
            (event.deltaX * (maxX - minX)) / Math.max(rect.width, 1),
          y:
            current.y -
            (event.deltaY * (maxY - minY)) / Math.max(rect.height, 1),
        },
        "wheel",
        event
      );
    };
    const wheel = new AbortController();
    element.addEventListener("wheel", handle, {
      passive: false,
      signal: wheel.signal,
    });
    return () => wheel.abort();
  };

  return {
    attachWheel,
    getSnapshot,
    keyDown,
    press,
    reset: (event) => setAtOnce(resetValue(), "reset", event),
    setOptions: (next) => {
      options = next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    type: (axis, typed, event) =>
      setAtOnce({ ...displayed(), [axis]: typed }, "input-change", event),
  };
}
