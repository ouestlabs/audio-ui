import {
  bindDrag,
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import { clamp } from "@ui-sdk/core/number";
import { definePrimitive, flag, sourceOf } from "../primitive";

/**
 * The pad grid: a pad sounds while it is held, by pointer or from the
 * keyboard, each pointer holds its own pad, pads of a choke group stop each
 * other, and the grid is one tab stop.
 *
 * A pad is keyed by its `value`. The reading order of the pads, which the
 * arrow keys walk, is their order in the document, read from the elements as
 * they bind.
 */

/** The softest a pointer strike plays: the very bottom of a pad, not silence. */
const MIN_VELOCITY = 0.25;
/** What a pad struck from the keyboard sounds at. */
const KEYBOARD_VELOCITY = 0.8;
/** What a pointer that cannot measure force reports while pressed. */
const UNMEASURED_PRESSURE = 0.5;
/** Home and End land on the first and last pads, then look inward for one that is enabled. */
const SCAN_FROM_END: Partial<Record<string, number>> = { End: -1, Home: 1 };

/** What a strike reports to `onPadOn`. */
export interface PadOnDetails {
  cancel: () => void;
  event?: Event;
  reason: string;
  source?: string;
  /** How hard the pad was struck, from 0 to 1. */
  velocity: number;
}

/** What a release reports to `onPadOff`. */
export interface PadOffDetails {
  event?: Event;
  /** `"press"`, `"keyboard"`, or `"choke"` when another pad of its group cut it. */
  reason: string;
}

export interface PadPrimitiveOptions {
  /** Pads lit from elsewhere, on top of the ones held here. */
  activePads?: readonly string[];
  /** How many pads a row holds: what the up and down arrows move by. @default 4 */
  columns?: number;
  disabled?: boolean;
  onPadOff?: (value: string, details: PadOffDetails) => void;
  onPadOn?: (value: string, details: PadOnDetails) => void;
}

export interface PadState {
  activePads: readonly string[];
  columns: number;
  disabled: boolean;
  /** The pads that cannot be struck or focused, which the arrow keys step over. */
  disabledValues: readonly string[];
  /** The pad focus was last put on, by a key or a press. */
  focused: string | null;
  /** How many holds each pad has: each pointer and the keyboard hold their own strike. */
  held: ReadonlyMap<string, number>;
  /** Every pad, in reading order. */
  order: readonly string[];
  /** How hard each pad was last struck, from 0 to 1. */
  velocities: ReadonlyMap<string, number>;
}

/** What a view draws the pads from. */
export interface PadSnapshot {
  /** Pads sounding: held here, or listed in `activePads`. */
  active: ReadonlySet<string>;
  disabled: boolean;
  /** The pad the grid's single tab stop is on. */
  tabStop: string | undefined;
  /** How hard each pad was last struck, from 0 to 1. */
  velocities: ReadonlyMap<string, number>;
}

const views = new WeakMap<PadState, PadSnapshot>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: PadState): PadSnapshot {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const enabled = state.order.filter(
    (value) => !state.disabledValues.includes(value)
  );
  const view: PadSnapshot = {
    active: new Set([...state.held.keys(), ...state.activePads]),
    disabled: state.disabled,
    tabStop:
      state.focused !== null && enabled.includes(state.focused)
        ? state.focused
        : enabled[0],
    velocities: state.velocities,
  };
  views.set(state, view);
  return view;
}

/**
 * How hard a pointer strikes: the force it reports when it can measure one,
 * such as a pen or a pressure-sensitive screen, else where it lands, harder
 * toward the top of the pad.
 */
function strikeVelocity(event: PointerEvent, rect: DOMRect) {
  const measured =
    event.pointerType !== "mouse" &&
    event.pressure > 0 &&
    event.pressure !== UNMEASURED_PRESSURE;
  const force = measured
    ? event.pressure
    : 1 - (event.clientY - rect.top) / rect.height;
  const velocity = MIN_VELOCITY + (1 - MIN_VELOCITY) * clamp(force, 0, 1);
  return Number.isFinite(velocity) ? velocity : KEYBOARD_VELOCITY;
}

/**
 * The index the arrow and Home/End keys move to from `index` in a grid of
 * `count` pads, `columns` to a row: left and right step through the reading
 * order, up and down by a row. Null when the key does not move, or would leave
 * the grid.
 */
function padTarget(index: number, count: number, columns: number, key: string) {
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
  return target === undefined || target < 0 || target >= count ? null : target;
}

/** A pad as a strike sees it. */
interface PadTarget {
  chokeGroup?: string;
  value: string;
}

/** What a pad reads of itself. */
export interface PadItemState {
  /** Whether the pad is sounding: held here, or listed in `activePads`. */
  active: boolean;
  disabled: boolean;
}

/** What a part's className, style and children functions read. */
export interface PadRootState {
  disabled: boolean;
}

/** What a pad grid's `api` gives an adapter. */
export interface PadApi {
  /** Moves the tab stop and the focus to the pad `value`. */
  focus: (value: string) => void;
  /** Moves the tab stop to `value`, leaving focus where it is. */
  focusPad: (value: string) => void;
  /** Which key a `"key"` prop is keyed by. */
  internal: { keyOf: (value: unknown) => string };
  /** Releases a pad struck from the keyboard. */
  keyOff: (value: string, event: FocusEvent | KeyboardEvent) => void;
  /** Strikes a pad from the keyboard: it sounds until the key is released or the pad loses focus. */
  keyOn: (pad: PadTarget, event: KeyboardEvent) => void;
  /** Where the arrow and Home/End keys take the focus from `value`: the pad to focus, or null when the key does not move it. */
  navigate: (value: string, event: KeyboardEvent) => string | null;
  /** Strikes the pad rendered by `element` with a pointer, and holds it until that pointer is released. */
  press: (pad: PadTarget, event: PointerEvent, element: HTMLElement) => void;
  /** Reads the pads' order and which are disabled again, from the document. */
  refresh: () => void;
  /** Called by a pad as it binds, with its element, and as it unbinds, with none. */
  register: (
    value: string,
    el: HTMLElement | null,
    props: () => ItemProps
  ) => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The props of a pad. */
interface ItemProps extends PartProps {
  /** Pads sharing a choke group stop each other. */
  chokeGroup?: string;
  disabled?: boolean;
  /** What identifies this pad in `onPadOn`, `onPadOff` and `activePads`. */
  value: string;
}

/** The pad grid's slots, by name, with the props and the public state of each. */
export type PadSlots = {
  item: SlotDefinition<PadState, PadApi, ItemProps, PadItemState>;
  root: SlotDefinition<PadState, PadApi, PartProps, PadRootState>;
};

/**
 * The type of `pad`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface PadPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: PadSlots;
  (
    initialOptions: PadPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: PadApi;
    get: () => PadState;
    types: {
      api: PadApi;
      options: PadPrimitiveOptions;
      slots: PadSlots;
      state: PadState;
    };
  };
}

/** The state an options object asks for, with the defaults of the grid. */
const stateOf = (options: PadPrimitiveOptions) => ({
  activePads: options.activePads ?? [],
  columns: options.columns ?? 4,
  disabled: options.disabled ?? false,
});

/** Whether a pad, or the whole grid, is disabled. */
const isDisabled = (state: PadState, props: ItemProps) =>
  state.disabled || Boolean(props.disabled);

export const pad: PadPrimitive = definePrimitive({
  api: (context) => {
    const state = () => context.store.get() as PadState;
    const set = (next: Partial<PadState>) => context.store.set(next as never);
    /** The pads bound now: their element and their part, whose props are the newest. */
    const items = new Map<
      string,
      { el: HTMLElement; props: () => ItemProps }
    >();
    /** What each pointer holds, and whether it still sounds. */
    const pointers = new Map<
      number,
      { sounding: boolean; stop: () => void; value: string }
    >();
    /** Whether the keyboard holds each pad. */
    const heldByKeyboard = new Map<string, boolean>();
    /** The last pad struck in each choke group, held or still ringing. */
    const ringing = new Map<string, string>();
    context.onDestroy(() => {
      for (const hold of pointers.values()) {
        hold.stop();
      }
    });

    const refresh = () => {
      // The reading order of the pads is their order in the document.
      const ordered = [...items].sort(([, a], [, b]) =>
        a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1
      );
      set({
        disabledValues: ordered
          .filter(([, item]) => item.props().disabled)
          .map(([value]) => value),
        order: ordered.map(([value]) => value),
      });
    };

    const release = (value: string) => {
      const held = new Map(state().held);
      const count = (held.get(value) ?? 0) - 1;
      if (count > 0) {
        held.set(value, count);
      } else {
        held.delete(value);
      }
      set({ held });
    };

    const padOff = (value: string, reason: string, event: Event) => {
      release(value);
      dispatch(context, "onPadOff", value, { event, reason });
    };

    /** Stops the other pad of the struck pad's choke group, and what still holds it. */
    const choke = (target: PadTarget, event: Event) => {
      if (target.chokeGroup === undefined) {
        return;
      }
      const previous = ringing.get(target.chokeGroup);
      ringing.set(target.chokeGroup, target.value);
      if (previous === undefined || previous === target.value) {
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
      dispatch(context, "onPadOff", previous, { event, reason: "choke" });
    };

    /** Strikes a pad, unless the grid is disabled or a listener refuses it; says whether it sounds. */
    const padOn = (
      target: PadTarget,
      reason: string,
      event: Event,
      velocity: number
    ) => {
      if (state().disabled) {
        return false;
      }
      const source = sourceOf(event);
      // The kernel makes the details the listener sees: its answer is the cancel.
      const canceled = dispatch(context, "onPadOn", target.value, {
        event,
        reason,
        ...(source ? { source } : {}),
        velocity,
      });
      if (canceled) {
        return false;
      }
      choke(target, event);
      const now = state();
      set({
        held: new Map(now.held).set(
          target.value,
          (now.held.get(target.value) ?? 0) + 1
        ),
        velocities: new Map(now.velocities).set(target.value, velocity),
      });
      return true;
    };

    return {
      focus: (value: string) => {
        set({ focused: value });
        items.get(value)?.el.focus({ preventScroll: true });
      },
      focusPad: (value: string) => set({ focused: value }),
      internal: { keyOf: (value: unknown) => String(value) },
      keyOff: (value: string, event: FocusEvent | KeyboardEvent) => {
        if (!heldByKeyboard.get(value)) {
          return;
        }
        heldByKeyboard.set(value, false);
        padOff(value, "keyboard", event);
      },
      keyOn: (target: PadTarget, event: KeyboardEvent) => {
        if (event.repeat || heldByKeyboard.get(target.value)) {
          return;
        }
        heldByKeyboard.set(
          target.value,
          padOn(target, "keyboard", event, KEYBOARD_VELOCITY)
        );
      },
      navigate: (value: string, event: KeyboardEvent) => {
        const { columns, disabledValues, order } = state();
        const enabled = (each: string | undefined) =>
          each !== undefined && !disabledValues.includes(each);
        const index = order.indexOf(value);
        let target =
          index === -1
            ? null
            : padTarget(index, order.length, columns, event.key);
        if (target === null) {
          return null;
        }
        // A disabled pad is stepped over, in the direction the key moves.
        const step = SCAN_FROM_END[event.key] ?? target - index;
        let next = order[target];
        while (next !== undefined && !enabled(next) && step !== 0) {
          target += step;
          next = order[target];
        }
        if (next === undefined || !enabled(next)) {
          return null;
        }
        set({ focused: next });
        return next;
      },
      press: (target: PadTarget, event: PointerEvent, element: HTMLElement) => {
        if (state().disabled || event.button !== 0) {
          return;
        }
        set({ focused: target.value });
        const hold: { sounding: boolean; stop: () => void; value: string } = {
          sounding: padOn(
            target,
            "press",
            event,
            strikeVelocity(event, element.getBoundingClientRect())
          ),
          stop: () => undefined,
          value: target.value,
        };
        // Each pointer holds its own pad, until it is released.
        pointers.get(event.pointerId)?.stop();
        pointers.set(event.pointerId, hold);
        hold.stop = bindDrag(element, event, {
          onEnd: (end) => {
            if (pointers.get(event.pointerId) === hold) {
              pointers.delete(event.pointerId);
            }
            if (hold.sounding) {
              padOff(target.value, "press", end);
            }
          },
          onMove: () => undefined,
        });
      },
      refresh,
      register: (
        value: string,
        el: HTMLElement | null,
        props: () => ItemProps
      ) => {
        if (el) {
          items.set(value, { el, props });
        } else {
          items.delete(value);
        }
        refresh();
      },
    };
  },
  name: "pad",
  options: {
    activePads: "value",
    columns: "number",
    disabled: "boolean",
    onPadOff: "callback",
    onPadOn: "callback",
  },
  slots: (slot) => ({
    item: slot<ItemProps, PadItemState>({
      attrs: (state: PadState, { props }) => {
        const view = viewOf(state);
        const disabled = isDisabled(state, props);
        const velocity = view.velocities.get(props.value);
        return {
          "data-active": flag(view.active.has(props.value)),
          "data-disabled": flag(disabled),
          disabled: flag(disabled),
          style: css({
            "touch-action": "none",
            ...(velocity === undefined
              ? {}
              : { "--pad-velocity": String(velocity) }),
          }),
          tabindex: props.value === view.tabStop ? "0" : "-1",
          type: "button",
        };
      },
      bind: (el, part) => {
        part.api.register(part.props.value, el, () => part.props);
        return () =>
          part.api.register(part.props.value, null, () => part.props);
      },
      on: {
        blur: (event, { api, props }) => api.keyOff(props.value, event),
        focus: (_event, { api, props }) => api.focusPad(props.value),
        keydown: (event, { api, props, store }) => {
          api.refresh();
          if (isDisabled(store.get(), props)) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            api.keyOn(
              { chokeGroup: props.chokeGroup, value: props.value },
              event
            );
            return;
          }
          const next = api.navigate(props.value, event);
          if (next !== null) {
            event.preventDefault();
            api.focus(next);
          }
        },
        keyup: (event, { api, props }) => {
          if (event.key === "Enter" || event.key === " ") {
            api.keyOff(props.value, event);
          }
        },
        pointerdown: (event, { api, el, props, store }) => {
          api.refresh();
          if (!el || isDisabled(store.get(), props) || event.button !== 0) {
            return;
          }
          event.preventDefault();
          api.focusPad(props.value);
          el.focus({
            focusVisible: false,
            preventScroll: true,
          } as FocusOptions);
          api.press(
            { chokeGroup: props.chokeGroup, value: props.value },
            event,
            el
          );
        },
      },
      props: { chokeGroup: "string", disabled: "boolean", value: "key" },
      state: (state: PadState, { props }) => ({
        active: viewOf(state).active.has(props.value),
        disabled: isDisabled(state, props),
      }),
    }),
    root: slot<object, PadRootState>({
      attrs: (state: PadState) => ({
        "data-disabled": flag(state.disabled),
        role: "group",
        // For a stylesheet to lay the grid out as the arrow keys walk it.
        style: css({ "--pad-columns": String(state.columns) }),
      }),
      state: (state: PadState) => ({ disabled: state.disabled }),
    }),
  }),
  state: (options: PadPrimitiveOptions): PadState => ({
    ...stateOf(options),
    disabledValues: [],
    focused: null,
    held: new Map(),
    order: [],
    velocities: new Map(),
  }),
  sync: stateOf,
});