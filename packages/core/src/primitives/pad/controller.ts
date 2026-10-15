import { followPointer } from "../../dom/gesture.ts";
import { clampUnit } from "../../shared/math.ts";
import {
  type ChangeEventDetails,
  type CommitEventDetails,
  createChangeEventDetails,
} from "../../value/events.ts";

/** The softest a pointer strike plays: the very bottom of a pad, not silence. */
export const MIN_VELOCITY = 0.25;
/** What a pad struck from the keyboard sounds at. */
export const KEYBOARD_VELOCITY = 0.8;
/** What a pointer that cannot measure force reports while pressed. */
const UNMEASURED_PRESSURE = 0.5;
/** Home and End land on the first and last pads, then look inward for one that is enabled. */
const SCAN_FROM_END: Partial<Record<string, number>> = { End: -1, Home: 1 };

export type PadOnEventDetails = { velocity: number } & (
  | ChangeEventDetails<"press", PointerEvent>
  | ChangeEventDetails<"keyboard", KeyboardEvent>
);
export type PadOffEventDetails =
  | CommitEventDetails<"press", PointerEvent>
  | CommitEventDetails<"keyboard", FocusEvent | KeyboardEvent>
  | CommitEventDetails<"choke", KeyboardEvent | PointerEvent>;

/** A pad as a strike sees it. */
export interface PadTarget {
  /** Pads sharing a choke group stop each other: striking one stops the last one struck. */
  chokeGroup?: string;
  value: string;
}

export interface PadOptions {
  /** Pads lit from elsewhere, on top of the ones held here. */
  activePads?: readonly string[];
  /** How many pads a row holds: what the up and down arrows move by. */
  columns: number;
  disabled?: boolean;
  /** Pads that cannot be struck or focused: the arrow keys step over them. */
  disabledValues?: readonly string[];
  onPadOff?: (value: string, details: PadOffEventDetails) => void;
  onPadOn?: (value: string, details: PadOnEventDetails) => void;
  /** Every pad, in reading order. */
  values: readonly string[];
}

export interface PadSnapshot {
  /** Pads sounding: held here, or listed in `activePads`. */
  active: ReadonlySet<string>;
  disabled: boolean;
  /** The pad the grid's single tab stop is on. */
  tabStop: string | undefined;
  /** How hard each pad was last struck, from 0 to 1. */
  velocities: ReadonlyMap<string, number>;
}

export interface PadController {
  /** Moves the tab stop to `value`, leaving focus where it is. */
  focusPad: (value: string) => void;
  getSnapshot: () => PadSnapshot;
  keyOff: (value: string, event: FocusEvent | KeyboardEvent) => void;
  /** Pads struck from the keyboard: Enter or Space sounds the pad, until it is released or loses focus. */
  keyOn: (pad: PadTarget, event: KeyboardEvent) => void;
  /** Where the arrow and Home/End keys take the focus from `value`: the pad to focus, or null when the key does not move it. */
  navigate: (value: string, event: KeyboardEvent) => string | null;
  /** Strikes the pad rendered by `element` with a pointer, and holds it until that pointer is released. */
  press: (pad: PadTarget, event: PointerEvent, element: Element) => void;
  setOptions: (options: PadOptions) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * How hard a pointer strikes: the force it reports when it can measure one,
 * such as a pen or a pressure-sensitive screen, else where it lands, harder
 * toward the top of the pad.
 */
export function strikeVelocity(
  event: Pick<PointerEvent, "clientY" | "pointerType" | "pressure">,
  rect: Pick<DOMRect, "height" | "top">
): number {
  const measured =
    event.pointerType !== "mouse" &&
    event.pressure > 0 &&
    event.pressure !== UNMEASURED_PRESSURE;
  const force = measured
    ? event.pressure
    : 1 - (event.clientY - rect.top) / rect.height;
  const velocity = MIN_VELOCITY + (1 - MIN_VELOCITY) * clampUnit(force);
  return Number.isFinite(velocity) ? velocity : KEYBOARD_VELOCITY;
}

/**
 * The index the arrow and Home/End keys move to from `index` in a grid of
 * `count` pads, `columns` to a row: left and right step through the reading
 * order, up and down by a row. Null when the key does not move, or would leave
 * the grid.
 */
export function padTarget(
  index: number,
  count: number,
  columns: number,
  key: string
): number | null {
  const row = Math.max(1, Math.round(columns));
  const targets: Record<string, number> = {
    ArrowDown: index + row,
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    ArrowUp: index - row,
    End: count - 1,
    Home: 0,
  };
  const target = targets[key];
  if (target === undefined || target < 0 || target >= count) {
    return null;
  }
  return target;
}

/**
 * A grid of pads with no view attached: which pads sound, struck by pointer or
 * keyboard, how hard, which ones choke each other, and where the grid's one
 * tab stop is.
 */
export function createPadController(initial: PadOptions): PadController {
  let options = initial;
  // A pad sounds while anything holds it: each pointer and the keyboard hold their own strike.
  let held = new Map<string, number>();
  const pointers = new Map<number, { sounding: boolean; value: string }>();
  const heldByKeyboard = new Map<string, boolean>();
  // The last pad struck in each choke group, held or still ringing.
  const ringing = new Map<string, string>();
  let velocities = new Map<string, number>();
  let focusedValue: string | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const isEnabled = (value: string) => !options.disabledValues?.includes(value);

  let snapshot: PadSnapshot | null = null;
  let snapshotKey = "";
  const getSnapshot = (): PadSnapshot => {
    const active = new Set([...held.keys(), ...(options.activePads ?? [])]);
    const disabled = options.disabled ?? false;
    const enabled = options.values.filter(isEnabled);
    const tabStop =
      focusedValue !== null && enabled.includes(focusedValue)
        ? focusedValue
        : enabled[0];
    // The snapshot is rebuilt only when what it shows changes, so a view re-renders for it alone.
    const key = JSON.stringify([
      [...active].sort(),
      disabled,
      tabStop,
      [...velocities],
    ]);
    if (snapshot && key === snapshotKey) {
      return snapshot;
    }
    snapshotKey = key;
    snapshot = { active, disabled, tabStop, velocities };
    return snapshot;
  };

  const release = (value: string) => {
    const count = (held.get(value) ?? 0) - 1;
    held = new Map(held);
    if (count > 0) {
      held.set(value, count);
    } else {
      held.delete(value);
    }
  };

  /** Stops the other pad of the struck pad's choke group, and what still holds it. */
  const choke = (pad: PadTarget, event: KeyboardEvent | PointerEvent) => {
    if (pad.chokeGroup === undefined) {
      return;
    }
    const previous = ringing.get(pad.chokeGroup);
    ringing.set(pad.chokeGroup, pad.value);
    if (previous === undefined || previous === pad.value) {
      return;
    }
    for (const hold of pointers.values()) {
      if (hold.value === previous && hold.sounding) {
        hold.sounding = false;
        release(previous);
      }
    }
    if (heldByKeyboard.get(previous)) {
      heldByKeyboard.set(previous, false);
      release(previous);
    }
    options.onPadOff?.(previous, { event, reason: "choke" });
  };

  const padOn = (pad: PadTarget, details: PadOnEventDetails): boolean => {
    if (options.disabled) {
      return false;
    }
    options.onPadOn?.(pad.value, details);
    if (details.isCanceled) {
      return false;
    }
    choke(pad, details.event);
    held = new Map(held).set(pad.value, (held.get(pad.value) ?? 0) + 1);
    velocities = new Map(velocities).set(pad.value, details.velocity);
    notify();
    return true;
  };

  const padOff = (value: string, details: PadOffEventDetails) => {
    release(value);
    notify();
    options.onPadOff?.(value, details);
  };

  const press: PadController["press"] = (pad, event, element) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    element.setPointerCapture?.(event.pointerId);
    focusedValue = pad.value;
    const velocity = strikeVelocity(event, element.getBoundingClientRect());
    const sounding = padOn(
      pad,
      Object.assign(createChangeEventDetails("press", event), { velocity })
    );
    if (!sounding) {
      notify();
    }
    const hold = { sounding, value: pad.value };
    pointers.set(event.pointerId, hold);
    followPointer(
      element,
      event.pointerId,
      () => undefined,
      (end) => {
        pointers.delete(end.pointerId);
        if (hold.sounding) {
          padOff(pad.value, { event: end, reason: "press" });
        }
      }
    );
  };

  const keyOn: PadController["keyOn"] = (pad, event) => {
    if (event.repeat || heldByKeyboard.get(pad.value)) {
      return;
    }
    const sounding = padOn(
      pad,
      Object.assign(createChangeEventDetails("keyboard", event), {
        velocity: KEYBOARD_VELOCITY,
      })
    );
    heldByKeyboard.set(pad.value, sounding);
  };

  const keyOff: PadController["keyOff"] = (value, event) => {
    if (!heldByKeyboard.get(value)) {
      return;
    }
    heldByKeyboard.set(value, false);
    padOff(value, { event, reason: "keyboard" });
  };

  const navigate: PadController["navigate"] = (value, event) => {
    const { columns, values } = options;
    const index = values.indexOf(value);
    let target =
      index === -1 ? null : padTarget(index, values.length, columns, event.key);
    if (target === null) {
      return null;
    }
    // A disabled pad is stepped over, in the direction the key moves.
    const step = SCAN_FROM_END[event.key] ?? target - index;
    let next = values[target];
    while (next !== undefined && !isEnabled(next) && step !== 0) {
      target += step;
      next = values[target];
    }
    if (next === undefined || !isEnabled(next)) {
      return null;
    }
    focusedValue = next;
    notify();
    return next;
  };

  return {
    focusPad: (value) => {
      focusedValue = value;
      notify();
    },
    getSnapshot,
    keyOff,
    keyOn,
    navigate,
    press,
    setOptions: (next) => {
      options = next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
