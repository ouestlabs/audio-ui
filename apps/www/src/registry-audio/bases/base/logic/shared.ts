import {
  bindDrag,
  type ChangeSource,
  createChange,
  dispatch,
  type PointerSample,
  type PrimitiveContext,
} from "@ui-sdk/core";

/** A boolean as a data attribute: present and empty, or absent. */
export const flag = (on: boolean) => (on ? "" : undefined);

/** What a change reports to `onValueChange`, beside the value. */
export interface ChangeDetails {
  cancel: () => void;
  event?: Event;
  /** The point or segment that moved, for a control that has several. */
  index?: number;
  reason: string;
  source?: string;
}

/** What a commit reports to `onValueCommitted`, beside the value. */
export interface CommitDetails {
  event?: Event;
  index?: number;
  reason: string;
}

/** How a native input is hidden while it keeps the focus, the keys and the name. */
export const VISUALLY_HIDDEN = {
  border: "0",
  "clip-path": "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "absolute",
  "white-space": "nowrap",
  width: "1px",
};

/**
 * How a change came about, when its event says. The kernel reads it from
 * input it tracks, so the first interaction would report "programmatic"
 * without this. With no event, the kernel decides, and an agent's change
 * stays the agent's.
 */
export function sourceOf(event?: Event): ChangeSource | undefined {
  if (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) {
    return event.pointerType === "touch" || event.pointerType === "pen"
      ? event.pointerType
      : "mouse";
  }
  if (event instanceof MouseEvent) {
    return "mouse";
  }
  if (event instanceof KeyboardEvent) {
    return "keyboard";
  }
}

/** A change or a commit's details: the reason, the event, and who caused it when the event says. */
function detailsOf(reason: string, event?: Event) {
  const source = sourceOf(event);
  return { event, reason, ...(source ? { source } : {}) };
}

/**
 * How a primitive whose state holds a `value` reports it: `report` fires
 * `onValueChange` and keeps the value unless an app refused it, `commit`
 * fires `onValueCommitted`, and `setAtOnce` does both, for a change that is
 * over as soon as it is made (a key, a typed value, the wheel, a reset). It
 * skips a value `same` finds equal to the one `displayed` shows; with no
 * `same`, every value is reported, even an unchanged one.
 */
export function createReporter<State extends { value: Value }, Value>(
  context: PrimitiveContext<any, State, any>,
  displayed: (state: State) => Value,
  same?: (a: Value, b: Value) => boolean
) {
  const change = createChange(context);
  const state = () => context.store.get() as State;
  const commit = (value: Value, reason: string, event?: Event) => {
    dispatch(context, "onValueCommitted", value, detailsOf(reason, event));
  };
  const report = (value: Value, reason: string, event?: Event) =>
    change("value", value as never, detailsOf(reason, event) as never);
  const setAtOnce = (value: Value, reason: string, event?: Event) => {
    if (same?.(value, displayed(state()))) {
      return;
    }
    if (report(value, reason, event)) {
      commit(value, reason, event);
    }
  };
  return { commit, report, setAtOnce, state };
}

const formatters = new Map<string, Intl.NumberFormat>();

/** The number format of a locale and options, made once and kept. */
export function numberFormat(
  locale: Intl.LocalesArgument | undefined,
  options: Intl.NumberFormatOptions | undefined
) {
  const key = JSON.stringify([locale, options]);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** What a gesture hears, from the press that started it to its release. */
export interface GestureHandlers<Data> {
  /** The pointer lifted, or the browser took it over (`canceled`). */
  onEnd: (event: PointerEvent, data: Data, canceled: boolean) => void;
  /** At most once per frame, with the latest pointer event. */
  onMove: (event: PointerEvent, data: Data, sample: PointerSample) => void;
}

/**
 * A primitive's pointer gestures, one at a time. Call `accepts` first, before
 * the primitive's own guards: another pointer pressing while a gesture runs
 * is refused, so a second finger does not take the gesture over, and the
 * same pointer pressing again means its release was missed, so its gesture
 * ends there, through `onStale`. A gesture carries `data` of its own, read
 * back by `active`, and stops when the primitive is destroyed.
 */
export function createGestures<Data>(context: {
  onDestroy: (cleanup: () => void) => void;
}) {
  type Running = { data: Data; pointerId: number; stop: () => void };
  let running: Running | null = null;
  context.onDestroy(() => running?.stop());
  return {
    /** Whether `event` may start a gesture, ending a stale one of the same pointer first. */
    accepts(event: PointerEvent, onStale?: (data: Data) => void) {
      const stale = running;
      if (!stale) {
        return true;
      }
      if (stale.pointerId !== event.pointerId) {
        return false;
      }
      running = null;
      stale.stop();
      onStale?.(stale.data);
      return true;
    },
    /** The data of the gesture that runs, if any. */
    active: () => running?.data ?? null,
    /** Follows the press on `el` until it lifts. */
    start(
      el: HTMLElement,
      event: PointerEvent,
      data: Data,
      handlers: GestureHandlers<Data>
    ) {
      running?.stop();
      const entry: Running = {
        data,
        pointerId: event.pointerId,
        stop: () => undefined,
      };
      running = entry;
      entry.stop = bindDrag(el, event, {
        onEnd: (end, canceled) => {
          if (running === entry) {
            running = null;
          }
          handlers.onEnd(end, data, canceled);
        },
        onMove: (sample) => handlers.onMove(sample.event, data, sample),
      });
    },
  };
}
