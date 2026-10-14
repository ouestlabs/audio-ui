import { isReleased } from "../../dom/pointer.ts";
import {
  clamp,
  clampFinite,
  degToRad,
  roundToStep,
  TAU,
} from "../../shared/math.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";
import {
  type ParameterScale,
  type ParameterScaleProp,
  resolveScale,
} from "../../value/scale.ts";
import {
  CENTER_DEAD_ZONE_MIN_PX,
  CENTER_DEAD_ZONE_REL,
  DOUBLE_TAP_MAX_MS,
  FINE_DRAG,
  pointerAngle,
  START_ANGLE,
  SWEEP_ANGLE,
  steppedValue,
  TAP_MAX_MOVE_PX,
  VERTICAL_DRAG_RANGE_PX,
  WHEEL_DELTA_EPSILON,
} from "./shared.ts";

export type KnobDragMode = "circular" | "revolution" | "vertical";

export type KnobChangeEventDetails =
  | ChangeEventDetails<"drag", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
  | ChangeEventDetails<"wheel", WheelEvent>
  | ChangeEventDetails<"reset", KeyboardEvent | PointerEvent>
  | ChangeEventDetails<"input-change", Event>;
export type KnobChangeEventReason = KnobChangeEventDetails["reason"];
export type KnobCommitEventDetails =
  | CommitEventDetails<"drag", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"wheel", WheelEvent>
  | CommitEventDetails<"reset", KeyboardEvent | PointerEvent>
  | CommitEventDetails<"input-change", Event>;
export type KnobCommitEventReason = KnobCommitEventDetails["reason"];

export interface KnobOptions {
  /** Value the indicator arc grows from, such as `0` on a -1…1 pan. Defaults to `min`. */
  anchor?: number;
  /** Uncontrolled starting value, and what a reset returns to; defaults to the middle of the travel. */
  defaultValue?: number;
  disabled?: boolean;
  /** @default "circular" */
  dragMode?: KnobDragMode;
  /** How the value is written, e.g. `{ maximumFractionDigits: 1 }`. */
  format?: Intl.NumberFormatOptions;
  /** Step for Page Up/Page Down and Shift + arrow keys. @default 10 */
  largeStep?: number;
  locale?: Intl.LocalesArgument;
  /** @default 100 */
  max?: number;
  /** @default 0 */
  min?: number;
  onValueChange?: (value: number, details: KnobChangeEventDetails) => void;
  onValueCommitted?: (value: number, details: KnobCommitEventDetails) => void;
  /** @default "linear" */
  scale?: ParameterScaleProp;
  /** @default 1 */
  step?: number;
  /** The controlled value; leave it out for the knob to hold its own. */
  value?: number;
}

/** What a view draws a knob from. */
export interface KnobSnapshot {
  anchor: number | undefined;
  /** Indicator arc origin, 0…1 along the sweep. */
  anchorPercent: number;
  /** Rotation in degrees, clockwise from 12 o'clock. */
  angle: number;
  disabled: boolean;
  /** Whether a pointer is turning the knob. */
  dragging: boolean;
  dragMode: KnobDragMode;
  /** The value as text, with `format` and `locale`. */
  formatted: string;
  largeStep: number;
  max: number;
  min: number;
  /** Value position, 0…1 along the sweep. */
  percent: number;
  resetValue: number;
  /** How the value maps onto the dial's travel. */
  scale: ParameterScale;
  step: number;
  /** The value as displayed: the dragged one while a pointer turns the knob. */
  value: number;
}

export interface KnobController {
  /** Listens to wheel steps on `element`; returns what removes the listener. */
  attachWheel: (element: HTMLElement) => () => void;
  getSnapshot: () => KnobSnapshot;
  /**
   * Handles a key on the knob's input: arrows, Page Up/Down, Home and End,
   * Shift for the large step, Delete or Backspace to reset. Returns `true`
   * when the knob takes the key, so the caller can prevent its default.
   */
  keyDown: (event: KeyboardEvent) => boolean;
  /**
   * Starts a pointer gesture on `control`: a drag turns the knob, a double
   * tap or an Alt + press resets it. The drag follows the pointer on the
   * document until it is released.
   */
  press: (event: PointerEvent, control: HTMLElement) => void;
  /** Returns to the default value, reporting a `"reset"` change and commit. */
  reset: (event: KeyboardEvent | PointerEvent) => void;
  /** Takes the latest options; call it whenever they may have changed. */
  setOptions: (options: KnobOptions) => void;
  subscribe: (listener: () => void) => () => void;
  /** Sets a typed value, on the grid, reporting an `"input-change"` change and commit. */
  type: (typed: number, event: Event) => void;
}

/** One pointer drag, from press to release. */
interface KnobGesture {
  /** Whether the gesture changed the value at least once; if so its end commits, even back on the start value. */
  changed: boolean;
  lastAngle: number;
  lastY: number;
  /** Farthest distance from the press point, in px. */
  maxDistance: number;
  pointerId: number;
  /**
   * Where the drag has taken the dial along its travel, 0…1 and beyond:
   * accumulated move by move, so Shift can make any stretch of it finer,
   * and kept apart from the rounded value so small moves add up.
   */
  position: number;
  rect: DOMRect;
  startX: number;
  startY: number;
}

/**
 * A knob's behavior with no view attached: its value, held or controlled,
 * every way of turning it, and what it looks like as a snapshot.
 */
export function createKnobController(
  initial: KnobOptions = {}
): KnobController {
  let options = initial;
  let scale: ParameterScale = resolveScale(initial.scale ?? "linear");
  const bounds = () => ({
    max: options.max ?? 100,
    min: options.min ?? 0,
    step: options.step ?? 1,
  });
  const resetValue = () => {
    const { max, min, step } = bounds();
    return (
      options.defaultValue ??
      roundToStep(scale.toValue(0.5, min, max), step, min)
    );
  };

  let uncontrolled: number | undefined;
  // Holds the turned value until the pointer is released, so a controlled
  // value that lags behind can't pull the knob back mid-drag.
  let dragValue: number | null = null;
  let dragging = false;
  let gesture: KnobGesture | null = null;
  let lastTapAt = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  let formatter: Intl.NumberFormat | null = null;
  let formatKey: unknown[] = [];
  const format = (value: number) => {
    if (
      !formatter ||
      formatKey[0] !== options.locale ||
      formatKey[1] !== options.format
    ) {
      formatter = new Intl.NumberFormat(options.locale, options.format);
      formatKey = [options.locale, options.format];
    }
    return formatter.format(value);
  };

  const displayed = () => {
    const { max, min } = bounds();
    const held =
      options.value === undefined
        ? (uncontrolled ?? resetValue())
        : options.value;
    return dragValue ?? clampFinite(held, min, max);
  };
  const onGrid = (raw: number) => {
    const { max, min, step } = bounds();
    return clamp(roundToStep(raw, step, min), min, max);
  };

  let snapshot: KnobSnapshot | null = null;
  const getSnapshot = () => {
    const { max, min, step } = bounds();
    const value = displayed();
    const { anchor, disabled = false, largeStep = 10 } = options;
    const dragMode = options.dragMode ?? "circular";
    const formatted = format(value);
    const reset = resetValue();
    if (
      snapshot?.value === value &&
      snapshot.dragging === dragging &&
      snapshot.min === min &&
      snapshot.max === max &&
      snapshot.step === step &&
      snapshot.largeStep === largeStep &&
      snapshot.anchor === anchor &&
      snapshot.disabled === disabled &&
      snapshot.dragMode === dragMode &&
      snapshot.formatted === formatted &&
      snapshot.resetValue === reset &&
      snapshot.scale === scale
    ) {
      return snapshot;
    }
    const percent = scale.toPosition(value, min, max);
    const anchorPercent =
      anchor === undefined ? 0 : scale.toPosition(anchor, min, max);
    snapshot = {
      anchor,
      anchorPercent,
      angle: START_ANGLE + percent * SWEEP_ANGLE,
      disabled,
      dragMode,
      dragging,
      formatted,
      largeStep,
      max,
      min,
      percent,
      resetValue: reset,
      scale,
      step,
      value,
    };
    return snapshot;
  };

  /** Reports a change; keeps it unless it was canceled, and says which. */
  const change = (next: number, details: KnobChangeEventDetails) => {
    if (next === displayed()) {
      return false;
    }
    options.onValueChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    if (options.value === undefined) {
      uncontrolled = next;
    } else if (details.reason === "drag") {
      dragValue = next;
    }
    notify();
    return true;
  };
  const commit = (next: number, details: KnobCommitEventDetails) => {
    options.onValueCommitted?.(next, details);
  };
  /** A change that is over as soon as it is made: keys, typed values, the wheel, a reset. */
  const setAtOnce = (
    next: number,
    reason: Exclude<KnobChangeEventReason, "drag">,
    event: Event
  ) => {
    const details = createChangeEventDetails(
      reason,
      event
    ) as KnobChangeEventDetails;
    if (change(next, details)) {
      commit(next, { event, reason } as KnobCommitEventDetails);
    }
  };

  /** The value a gesture has turned the knob to, after one pointer move. */
  const valueFromGesture = (current: KnobGesture, event: PointerEvent) => {
    const { max, min } = bounds();
    const speed = event.shiftKey ? FINE_DRAG : 1;
    if (options.dragMode === "vertical") {
      current.position +=
        ((current.lastY - event.clientY) / VERTICAL_DRAG_RANGE_PX) * speed;
    } else {
      const { rect } = current;
      const angle = pointerAngle(event.clientX, event.clientY, rect);
      const distance = Math.hypot(
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2)
      );
      const deadZone = Math.max(
        CENTER_DEAD_ZONE_MIN_PX,
        Math.min(rect.width, rect.height) * CENTER_DEAD_ZONE_REL
      );
      if (distance > deadZone) {
        let delta = angle - current.lastAngle;
        if (delta > Math.PI) {
          delta -= TAU;
        } else if (delta < -Math.PI) {
          delta += TAU;
        }
        const fullTurn =
          options.dragMode === "revolution" ? TAU : degToRad(SWEEP_ANGLE);
        current.position += (delta / fullTurn) * speed;
      }
      current.lastAngle = angle;
    }
    current.lastY = event.clientY;
    return scale.toValue(current.position, min, max);
  };

  /** Ends the gesture: a tap that moved little is a tap, and a second one soon after resets. */
  const finish = (end: PointerEvent, allowTap: boolean) => {
    if (!gesture) {
      return;
    }
    const current = gesture;
    gesture = null;
    dragging = false;
    const turned = displayed();
    dragValue = null;
    notify();

    if (allowTap && current.maxDistance <= TAP_MAX_MOVE_PX) {
      const now = performance.now();
      const isDoubleTap = now - lastTapAt <= DOUBLE_TAP_MAX_MS;
      lastTapAt = isDoubleTap ? 0 : now;
      if (isDoubleTap) {
        setAtOnce(resetValue(), "reset", end);
      }
      return;
    }
    lastTapAt = 0;
    if (current.changed) {
      commit(turned, { event: end, reason: "drag" });
    }
  };

  const press: KnobController["press"] = (event, control) => {
    if (options.disabled) {
      return;
    }
    // Alt + click returns to the default, as in a DAW.
    if (event.altKey) {
      setAtOnce(resetValue(), "reset", event);
      return;
    }
    control.setPointerCapture?.(event.pointerId);
    const rect = control.getBoundingClientRect();
    const { min, max } = bounds();
    const doc = control.ownerDocument;
    const drag = new AbortController();
    gesture = {
      changed: false,
      lastAngle: pointerAngle(event.clientX, event.clientY, rect),
      lastY: event.clientY,
      maxDistance: 0,
      pointerId: event.pointerId,
      position: scale.toPosition(displayed(), min, max),
      rect,
      startX: event.clientX,
      startY: event.clientY,
    };
    dragging = true;
    notify();

    const move = (moveEvent: PointerEvent) => {
      const current = gesture;
      if (!current || moveEvent.pointerId !== current.pointerId) {
        return;
      }
      if (isReleased(moveEvent)) {
        drag.abort();
        finish(moveEvent, true);
        return;
      }
      current.maxDistance = Math.max(
        current.maxDistance,
        Math.hypot(
          moveEvent.clientX - current.startX,
          moveEvent.clientY - current.startY
        )
      );
      if (
        change(
          onGrid(valueFromGesture(current, moveEvent)),
          createChangeEventDetails("drag", moveEvent)
        )
      ) {
        current.changed = true;
      }
    };
    const end = (endEvent: PointerEvent, allowTap: boolean) => {
      if (!gesture || endEvent.pointerId !== gesture.pointerId) {
        return;
      }
      drag.abort();
      finish(endEvent, allowTap);
    };
    const { signal } = drag;
    doc.addEventListener("pointermove", move, { signal });
    doc.addEventListener("pointerup", (up) => end(up, true), { signal });
    doc.addEventListener("pointercancel", (cancel) => end(cancel, false), {
      signal,
    });
  };

  const keyDown: KnobController["keyDown"] = (event) => {
    if (options.disabled) {
      return false;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      setAtOnce(resetValue(), "reset", event);
      return true;
    }
    const { max, min, step } = bounds();
    const current = displayed();
    const largeStep = options.largeStep ?? 10;
    const stepOptions = {
      largeStep,
      max,
      min,
      scale,
      step,
    };
    const targets: Record<string, number> = {
      ArrowDown: steppedValue(current, -1, event.shiftKey, stepOptions),
      ArrowLeft: steppedValue(current, -1, event.shiftKey, stepOptions),
      ArrowRight: steppedValue(current, 1, event.shiftKey, stepOptions),
      ArrowUp: steppedValue(current, 1, event.shiftKey, stepOptions),
      End: max,
      Home: min,
      PageDown: steppedValue(current, -1, true, stepOptions),
      PageUp: steppedValue(current, 1, true, stepOptions),
    };
    const target = targets[event.key];
    if (target === undefined) {
      return false;
    }
    setAtOnce(onGrid(target), "keyboard", event);
    return true;
  };

  const attachWheel: KnobController["attachWheel"] = (element) => {
    const handle = (event: WheelEvent) => {
      if (options.disabled || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      if (Math.abs(event.deltaY) < WHEEL_DELTA_EPSILON) {
        return;
      }
      const { max, min, step } = bounds();
      const next = steppedValue(displayed(), event.deltaY < 0 ? 1 : -1, false, {
        largeStep: options.largeStep ?? 10,
        max,
        min,
        scale,
        step,
      });
      setAtOnce(onGrid(next), "wheel", event);
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
    reset: (event) => setAtOnce(onGrid(resetValue()), "reset", event),
    setOptions: (next) => {
      options = next;
      scale = resolveScale(next.scale ?? "linear");
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    type: (typed, event) => setAtOnce(onGrid(typed), "input-change", event),
  };
}
