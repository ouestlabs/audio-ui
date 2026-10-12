import { isReleased } from "../../dom/pointer";
import { clamp, clampFinite, roundToStep } from "../../shared/math";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events";
import { DEFAULT_MAX, DEFAULT_MIN, WHEEL_DELTA_EPSILON } from "./defaults";

type Details<Reason extends string, E extends Event> = ChangeEventDetails<
  Reason,
  E
> & {
  /** Always `0`: a fader has one thumb. */
  activeThumbIndex: number;
};

export type FaderChangeEventDetails =
  | Details<"drag" | "track-press", PointerEvent>
  | Details<"keyboard", KeyboardEvent>
  | Details<"input-change", Event>
  | Details<"wheel", WheelEvent>
  | Details<"reset", KeyboardEvent | MouseEvent | PointerEvent>;
export type FaderChangeEventReason = FaderChangeEventDetails["reason"];
export type FaderCommitEventDetails =
  | CommitEventDetails<"drag" | "track-press", PointerEvent>
  | CommitEventDetails<"keyboard", KeyboardEvent>
  | CommitEventDetails<"input-change", Event>
  | CommitEventDetails<"wheel", WheelEvent>
  | CommitEventDetails<"reset", KeyboardEvent | MouseEvent | PointerEvent>;
export type FaderCommitEventReason = FaderCommitEventDetails["reason"];

export type FaderOrientation = "horizontal" | "vertical";

export interface FaderOptions {
  /** Value the fill starts from, such as `0` on a -1…1 pan. Defaults to `min`. */
  anchor?: number;
  /** Uncontrolled starting value, and what a reset returns to; defaults to the midpoint. */
  defaultValue?: number;
  disabled?: boolean;
  /** How the value is written, e.g. `{ maximumFractionDigits: 1 }`. */
  format?: Intl.NumberFormatOptions;
  /** Step for Page Up/Page Down and Shift + arrow keys. @default 10 */
  largeStep?: number;
  locale?: Intl.LocalesArgument;
  /** @default 6 */
  max?: number;
  /** @default -60 */
  min?: number;
  onValueChange?: (value: number, details: FaderChangeEventDetails) => void;
  onValueCommitted?: (value: number, details: FaderCommitEventDetails) => void;
  /** @default "vertical" */
  orientation?: FaderOrientation;
  /** @default 1 */
  step?: number;
  /** The controlled value; leave it out for the fader to hold its own. */
  value?: number;
}

/** What a view draws a fader from. */
export interface FaderSnapshot {
  anchor: number | undefined;
  disabled: boolean;
  /** Whether a pointer is moving the thumb. */
  dragging: boolean;
  /** The fill, from and to, as percentages of the travel. */
  fill: { from: number; to: number };
  /** The value as text, with `format` and `locale`. */
  formatted: string;
  largeStep: number;
  max: number;
  min: number;
  orientation: FaderOrientation;
  /** The thumb's place along the travel, as a percentage. */
  share: number;
  step: number;
  /** The value as displayed: the dragged one while a pointer holds the thumb. */
  value: number;
}

export interface FaderController {
  /** Listens to wheel steps on `element`; returns what removes the listener. */
  attachWheel: (element: HTMLElement) => () => void;
  getSnapshot: () => FaderSnapshot;
  /**
   * Handles a key on the fader's input: arrows, Page Up/Down, Home and End,
   * Shift for the large step, reversed on a right-to-left `element`. Returns
   * whether the key was the fader's, so the caller can prevent its default.
   */
  keyDown: (event: KeyboardEvent, element: Element) => boolean;
  /**
   * Starts a pointer gesture on the control: a press on the track jumps to
   * the value under it, a press inside `thumb` drags from where it was taken.
   * The drag follows the pointer on the document until it is released.
   */
  press: (
    event: PointerEvent,
    control: HTMLElement,
    thumb: HTMLElement | null
  ) => void;
  /** Returns to the default value, reporting a `"reset"` change and commit. */
  reset: (event: KeyboardEvent | MouseEvent | PointerEvent) => void;
  /** Takes the latest options; call it whenever they may have changed. */
  setOptions: (options: FaderOptions) => void;
  subscribe: (listener: () => void) => () => void;
  /** Sets a typed value, on the grid, reporting an `"input-change"` change and commit. */
  type: (typed: number, event: Event) => void;
}

/** The share of the travel `value` sits at, 0…100. */
export function faderShare(value: number, min: number, max: number): number {
  return clamp(((value - min) / (max - min || 1)) * 100, 0, 100);
}

const changeDetails = (reason: FaderChangeEventReason, event: Event) =>
  Object.assign(createChangeEventDetails(reason, event), {
    activeThumbIndex: 0,
  }) as FaderChangeEventDetails;

/**
 * A fader's behavior with no view attached: its value, held or controlled,
 * every way of changing it, and what it looks like as a snapshot.
 */
export function createFaderController(
  initial: FaderOptions = {}
): FaderController {
  let options = initial;
  const bounds = () => ({
    max: options.max ?? DEFAULT_MAX,
    min: options.min ?? DEFAULT_MIN,
    step: options.step ?? 1,
  });
  const resetValue = () => {
    const { max, min } = bounds();
    return options.defaultValue ?? min + (max - min) / 2;
  };

  let uncontrolled = resetValue();
  // Holds the dragged value until the pointer is released, so a controlled
  // value that lags behind can't pull the thumb back mid-drag.
  let dragValue: number | null = null;
  let dragging = false;
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
    const held = options.value === undefined ? uncontrolled : options.value;
    return dragValue ?? clampFinite(held, min, max);
  };

  let snapshot: FaderSnapshot | null = null;
  const getSnapshot = () => {
    const { max, min, step } = bounds();
    const value = displayed();
    const { anchor, disabled = false, largeStep = 10 } = options;
    const orientation = options.orientation ?? "vertical";
    const formatted = format(value);
    if (
      snapshot?.value === value &&
      snapshot.dragging === dragging &&
      snapshot.min === min &&
      snapshot.max === max &&
      snapshot.step === step &&
      snapshot.largeStep === largeStep &&
      snapshot.anchor === anchor &&
      snapshot.disabled === disabled &&
      snapshot.orientation === orientation &&
      snapshot.formatted === formatted
    ) {
      return snapshot;
    }
    const from = faderShare(Math.min(anchor ?? min, value), min, max);
    const to = faderShare(Math.max(anchor ?? min, value), min, max);
    snapshot = {
      anchor,
      disabled,
      dragging,
      fill: { from, to },
      formatted,
      largeStep,
      max,
      min,
      orientation,
      share: faderShare(value, min, max),
      step,
      value,
    };
    return snapshot;
  };

  /** Reports a change; keeps it unless it was canceled, and says which. */
  const change = (next: number, details: FaderChangeEventDetails) => {
    options.onValueChange?.(next, details);
    if (details.isCanceled) {
      return false;
    }
    if (options.value === undefined) {
      uncontrolled = next;
    } else if (details.reason === "drag" || details.reason === "track-press") {
      dragValue = next;
    }
    notify();
    return true;
  };
  const commit = (next: number, details: FaderCommitEventDetails) => {
    if (dragValue !== null) {
      dragValue = null;
      notify();
    }
    options.onValueCommitted?.(next, details);
  };
  /** A change that is over as soon as it is made: keys, typed values, the wheel, a reset. */
  const setAtOnce = (
    next: number,
    reason: Exclude<FaderChangeEventReason, "drag" | "track-press">,
    event: Event
  ) => {
    if (next === displayed()) {
      return;
    }
    if (change(next, changeDetails(reason, event))) {
      commit(next, { event, reason } as FaderCommitEventDetails);
    }
  };
  const onGrid = (raw: number) => {
    const { max, min, step } = bounds();
    return clamp(roundToStep(raw, step, min), min, max);
  };

  /** The value under a point of the control, on the grid. */
  const valueAt = (control: HTMLElement, x: number, y: number) => {
    const { max, min } = bounds();
    const box = control.getBoundingClientRect();
    const vertical = (options.orientation ?? "vertical") === "vertical";
    let share = vertical
      ? (box.bottom - y) / (box.height || 1)
      : (x - box.left) / (box.width || 1);
    if (!vertical && isRtl(control)) {
      share = 1 - share;
    }
    return onGrid(min + clamp(share, 0, 1) * (max - min));
  };

  const press: FaderController["press"] = (event, control, thumb) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    const vertical = (options.orientation ?? "vertical") === "vertical";
    const onThumb = Boolean(thumb?.contains(event.target as Node));
    // Taken by the thumb, the drag keeps the pointer where it grabbed it.
    let offset = 0;
    if (thumb && onThumb) {
      const box = thumb.getBoundingClientRect();
      offset = vertical
        ? event.clientY - (box.top + box.height / 2)
        : event.clientX - (box.left + box.width / 2);
    }
    let value = displayed();
    // Whether the gesture set a value, even one it later came back from.
    let changed = false;
    const { pointerId } = event;
    if (!onThumb) {
      const next = valueAt(control, event.clientX, event.clientY);
      if (next !== value && change(next, changeDetails("track-press", event))) {
        value = next;
        changed = true;
      }
    }
    dragging = true;
    notify();

    const doc = control.ownerDocument;
    const gesture = new AbortController();
    let moved = false;
    const finish = (end: PointerEvent) => {
      gesture.abort();
      dragging = false;
      notify();
      if (changed) {
        commit(value, {
          event: end,
          reason: moved ? "drag" : "track-press",
        } as FaderCommitEventDetails);
      } else if (dragValue !== null) {
        dragValue = null;
        notify();
      }
    };
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      if (isReleased(moveEvent)) {
        finish(moveEvent);
        return;
      }
      moved = true;
      const next = valueAt(
        control,
        moveEvent.clientX - (vertical ? 0 : offset),
        moveEvent.clientY - (vertical ? offset : 0)
      );
      if (next !== value && change(next, changeDetails("drag", moveEvent))) {
        value = next;
        changed = true;
      }
    };
    const { signal } = gesture;
    doc.addEventListener("pointermove", move, { signal });
    doc.addEventListener("pointerup", finish, { signal });
    doc.addEventListener("pointercancel", finish, { signal });
  };

  const keyDown: FaderController["keyDown"] = (event, element) => {
    if (options.disabled) {
      return false;
    }
    const { max, min, step } = bounds();
    const largeStep = options.largeStep ?? 10;
    const value = displayed();
    const vertical = (options.orientation ?? "vertical") === "vertical";
    const amount = event.shiftKey ? largeStep : step;
    const forward = !vertical && isRtl(element) ? -amount : amount;
    const targets: Record<string, number> = {
      ArrowDown: value - amount,
      ArrowLeft: value - forward,
      ArrowRight: value + forward,
      ArrowUp: value + amount,
      End: max,
      Home: min,
      PageDown: value - largeStep,
      PageUp: value + largeStep,
    };
    const target = targets[event.key];
    if (target === undefined) {
      return false;
    }
    setAtOnce(onGrid(target), "keyboard", event);
    return true;
  };

  const attachWheel: FaderController["attachWheel"] = (element) => {
    const handle = (event: WheelEvent) => {
      if (options.disabled || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      if (Math.abs(event.deltaY) < WHEEL_DELTA_EPSILON) {
        return;
      }
      const { step } = bounds();
      setAtOnce(
        onGrid(displayed() + (event.deltaY < 0 ? step : -step)),
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
    reset: (event) => {
      const { max, min } = bounds();
      setAtOnce(clamp(resetValue(), min, max), "reset", event);
    },
    setOptions: (next) => {
      options = next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    type: (typed, event) => setAtOnce(onGrid(typed), "input-change", event),
  };
}

/** Whether `element` lays out right to left, which reverses a horizontal travel. */
function isRtl(element: Element): boolean {
  const view = element.ownerDocument?.defaultView;
  return view ? view.getComputedStyle(element).direction === "rtl" : false;
}
