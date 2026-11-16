/**
 * What every primitive of audio/ui shares and the kernel does not do: parts
 * named in kebab case, a value reported as `onValueChange` and
 * `onValueCommitted`, one pointer gesture at a time, and a native input
 * hidden from sight. The primitives import it from `../primitive`.
 */
import {
  bindDrag,
  type ChangeSource,
  createChange,
  definePrimitive as definePrimitiveOf,
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

const KEBAB = /([a-z0-9])([A-Z])/g;
const kebab = (name: string) => name.replace(KEBAB, "$1-$2").toLowerCase();

/**
 * The part a primitive draws names itself in `data-slot`, in kebab case
 * (`xypad-input-x`, `piano-roll-note`), the names the styles and the docs
 * select: the kernel writes the slot's key as it is (`xypad-inputX`). A
 * component that gives its own name to a part (`timeline-time-selection`)
 * keeps it.
 */
function nameSlots(name: string, slots: Record<string, any>) {
  const prefix = kebab(name);
  for (const [key, definition] of Object.entries(slots)) {
    const fallback = key === "root" ? prefix : `${prefix}-${kebab(key)}`;
    const { attrs } = definition;
    definition.attrs = (state: unknown, context: { props?: object }) => ({
      ...attrs?.(state, context),
      "data-slot":
        (context.props as Record<string, string> | undefined)?.["data-slot"] ??
        fallback,
    });
    definition.props = { ...definition.props, "data-slot": "string" };
  }
  return slots;
}

/** `definePrimitive` of the kernel, with the parts named in kebab case and a `data-slot` that can be given. */
export const definePrimitive = ((options: any) =>
  definePrimitiveOf({
    ...options,
    slots: (slot: unknown) => nameSlots(options.name, options.slots(slot)),
  })) as typeof definePrimitiveOf;
