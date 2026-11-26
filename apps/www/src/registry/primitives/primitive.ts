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
function detailsOf(reason: string, event?: Event, extra?: object) {
  const source = sourceOf(event);
  return { event, reason, ...(source ? { source } : {}), ...extra };
}

/**
 * How a primitive whose state holds a `value` reports it: `report` fires
 * `onValueChange` and keeps the value unless an app refused it, `commit`
 * fires `onValueCommitted`, and `setAtOnce` does both, for a change that is
 * over as soon as it is made (a key, a typed value, the wheel, a reset). It
 * skips a value `same` finds equal to the one `displayed` shows; with no
 * `same`, every value is reported, even an unchanged one. `extra` goes into
 * the details, such as the `index` of the point that moved.
 */
export function createReporter<State extends { value: Value }, Value>(
  context: PrimitiveContext<any, State, any>,
  displayed: (state: State) => Value,
  same?: (a: Value, b: Value) => boolean
) {
  const change = createChange(context);
  const state = () => context.store.get() as State;
  const commit = (
    value: Value,
    reason: string,
    event?: Event,
    extra?: object
  ) => {
    dispatch(
      context,
      "onValueCommitted",
      value,
      detailsOf(reason, event, extra)
    );
  };
  const report = (
    value: Value,
    reason: string,
    event?: Event,
    extra?: object
  ) =>
    change("value", value as never, detailsOf(reason, event, extra) as never);
  const setAtOnce = (
    value: Value,
    reason: string,
    event?: Event,
    extra?: object
  ) => {
    if (same?.(value, displayed(state()))) {
      return;
    }
    if (report(value, reason, event, extra)) {
      commit(value, reason, event, extra);
    }
  };
  return { commit, report, setAtOnce, state };
}

/** Two numbers as one text: a comma between them, or a semicolon where the comma is the decimal mark. */
export function formatPair(formatter: Intl.NumberFormat, a: number, b: number) {
  const decimalComma = formatter
    .formatToParts(1.5)
    .some((part) => part.type === "decimal" && part.value === ",");
  return `${formatter.format(a)}${decimalComma ? "; " : ", "}${formatter.format(b)}`;
}

/** Where in an interval a curve is checked against its chord, how many times an interval may be halved, and a ceiling on the vertices of one curve. */
const PROBES = [0.25, 0.5, 0.75];
const MAX_DEPTH = 8;
const MAX_SAMPLES = 4096;

/**
 * The vertices of a polyline that draws `f(t)` for `t` from 0 to 1 without
 * straying more than `tolerance` from it: it starts from `grid` and halves
 * every interval whose curve leaves its chord. `width` is how wide `t` from 0
 * to 1 spans in the box the curve is drawn in.
 */
export function adaptiveSamples(
  f: (t: number) => number,
  grid: readonly number[],
  tolerance: number,
  width = 1
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

/**
 * What a change reports: why it happened (`reason`), the event behind it,
 * and `cancel()` to refuse the change.
 */
export interface ChangeEventDetails<Reason extends string, E extends Event> {
  cancel: () => void;
  event: E;
  readonly isCanceled: boolean;
  reason: Reason;
}

/** What a commit reports once a gesture ends: why it happened and the event behind it. */
export interface CommitEventDetails<Reason extends string, E extends Event> {
  event: E;
  reason: Reason;
}

/** The details of a change for `reason` and `event`, with `cancel()` to refuse it. */
export function createChangeEventDetails<
  Reason extends string,
  E extends Event,
>(reason: Reason, event: E): ChangeEventDetails<Reason, E> {
  let canceled = false;
  return {
    cancel: () => {
      canceled = true;
    },
    event,
    get isCanceled() {
      return canceled;
    },
    reason,
  };
}

/**
 * One pointer at a time on a control: while one drags, a press from another is
 * ignored, and the same pointer pressing again means its release was missed,
 * so the drag it left ends there. Moves arrive at most once per frame, each
 * with where the pointer was at the last one.
 */
export function createPointerLock() {
  type Held = {
    end: (event: PointerEvent) => void;
    pointerId: number;
    stop: () => void;
  };
  let held: Held | null = null;
  return {
    claim: (event: PointerEvent) => {
      if (!held) {
        return true;
      }
      if (held.pointerId !== event.pointerId) {
        return false;
      }
      const stale = held;
      held = null;
      stale.stop();
      stale.end(event);
      return true;
    },
    follow: (
      target: Element,
      down: PointerEvent,
      move: (event: PointerEvent, from: { x: number; y: number }) => void,
      end: (event: PointerEvent) => void
    ) => {
      let last = { x: down.clientX, y: down.clientY };
      const entry: Held = {
        end,
        pointerId: down.pointerId,
        stop: () => undefined,
      };
      held = entry;
      entry.stop = bindDrag(target as HTMLElement, down, {
        onEnd: (event) => {
          if (held === entry) {
            held = null;
          }
          end(event);
        },
        onMove: ({ event }) => {
          const from = last;
          last = { x: event.clientX, y: event.clientY };
          move(event, from);
        },
      });
    },
  };
}

/**
 * A value that changes outside the framework, in the shape of an external
 * store: `subscribe` registers a listener called on each change, and
 * `getSnapshot` returns the current value. What a primitive's `source` reads
 * from, so that following a signal costs no render.
 */
export interface Source<Value> {
  getSnapshot: () => Value;
  subscribe: (listener: () => void) => () => void;
}

/** A source that also takes values: what `createSource` returns. */
export interface WritableSource<Value> extends Source<Value> {
  /** Publishes a value. Subscribers are told every time, so the same array, updated in place, can be published again. */
  set: (value: Value) => void;
}

/**
 * A source you push to yourself, from an audio callback, a WebSocket, a worker
 * or a test: call `set` with each new reading, and whatever reads the source
 * follows.
 */
export function createSource<Value>(initial: Value): WritableSource<Value> {
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
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A value the primitive holds and its parts read outside any render. */
export interface Store<Value> {
  get: () => Value;
  set: (next: Value) => void;
  subscribe: (listener: () => void) => () => void;
}

/** A store holding `initial`: `set` tells every listener, unless the value is the same one. */
export function createStore<Value>(initial: Value): Store<Value> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) {
        return;
      }
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

/** An element's box for one gesture, from `measuredBox`. */
export interface MeasuredBox {
  /** The box: measured the first time, and again only after the page scrolled or resized. */
  get: () => DOMRect;
  /** Stops watching the page. Call it when the gesture ends. */
  stop: () => void;
}

/**
 * An element's box, measured once for a gesture rather than on each of its
 * moves. Read after a move wrote to the page, `getBoundingClientRect` makes
 * the browser lay the page out on the spot, every frame. A scroll or a resize
 * during the gesture moves the element, so either one measures it again.
 */
export function measuredBox(element: Element): MeasuredBox {
  let box: DOMRect | null = null;
  const view = element.ownerDocument?.defaultView;
  const stale = () => {
    box = null;
  };
  view?.addEventListener("scroll", stale, { capture: true, passive: true });
  view?.addEventListener("resize", stale, { passive: true });
  return {
    get: () => {
      box ??= element.getBoundingClientRect();
      return box;
    },
    stop: () => {
      view?.removeEventListener("scroll", stale, { capture: true });
      view?.removeEventListener("resize", stale);
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

/** The number a typed text means: "-6", "-6 dB" or "12,5". */
const typedNumber = (text: string) => {
  const parsed = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const INPUT_STYLE =
  "position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; border-radius: inherit; background: inherit; color: inherit; font: inherit; text-align: center; box-sizing: border-box";

/**
 * Lets the reader type a value into a control's readout: a double click on
 * it, or Enter or F2 while it has focus, lays a text field over it. Enter or
 * leaving the field gives the control the number typed, through its native
 * range input, as a drag would; Escape keeps the value. The framework keeps
 * drawing the readout's text under the field. `root` is the control's slot
 * (`knob`, `fader`). Returns what takes it away.
 */
export function editableReadout(readout: HTMLElement, root: string) {
  let field: HTMLInputElement | null = null;
  const positioned = readout.style.position;
  const finish = (text: string | null) => {
    if (!field) {
      return;
    }
    field.remove();
    field = null;
    readout.removeAttribute("data-editing");
    readout.style.position = positioned;
    readout.focus({ preventScroll: true });
    const typed = text === null ? null : typedNumber(text);
    const input = readout
      .closest(`[data-slot="${root}"]`)
      ?.querySelector<HTMLInputElement>('input[type="range"]');
    if (typed === null || !input) {
      return;
    }
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, String(typed));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const open = () => {
    if (field || readout.closest("[data-disabled]")) {
      return;
    }
    const text = readout.textContent?.trim() ?? "";
    field = document.createElement("input");
    field.type = "text";
    field.inputMode = "decimal";
    field.value = text;
    field.size = Math.max(text.length, 3);
    field.style.cssText = INPUT_STYLE;
    const label = readout.getAttribute("aria-label");
    if (label) {
      field.setAttribute("aria-label", label);
    }
    field.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        finish(field?.value ?? null);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    });
    field.addEventListener("blur", () => finish(field?.value ?? null));
    if (getComputedStyle(readout).position === "static") {
      readout.style.position = "relative";
    }
    readout.setAttribute("data-editing", "");
    readout.appendChild(field);
    field.focus({ preventScroll: true });
    field.select();
  };
  // A readout inside a thumb or a control must not also reset or drag it.
  const handleDoubleClick = (event: MouseEvent) => {
    event.stopPropagation();
    open();
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (
      event.target === readout &&
      (event.key === "Enter" || event.key === "F2")
    ) {
      event.preventDefault();
      open();
    }
  };
  const handlePointerDown = (event: PointerEvent) => event.stopPropagation();
  const tabIndex = readout.getAttribute("tabindex");
  readout.tabIndex = 0;
  readout.setAttribute("aria-keyshortcuts", "Enter");
  readout.setAttribute("data-editable", "");
  readout.addEventListener("dblclick", handleDoubleClick);
  readout.addEventListener("keydown", handleKeyDown);
  readout.addEventListener("pointerdown", handlePointerDown);
  return () => {
    finish(null);
    readout.removeEventListener("dblclick", handleDoubleClick);
    readout.removeEventListener("keydown", handleKeyDown);
    readout.removeEventListener("pointerdown", handlePointerDown);
    readout.removeAttribute("aria-keyshortcuts");
    readout.removeAttribute("data-editable");
    if (tabIndex === null) {
      readout.removeAttribute("tabindex");
    } else {
      readout.setAttribute("tabindex", tabIndex);
    }
  };
}
