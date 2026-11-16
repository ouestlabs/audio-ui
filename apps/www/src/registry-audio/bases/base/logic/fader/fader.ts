import {
  bindDrag,
  createChange,
  css,
  dispatch,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import {
  clamp,
  fractionOf,
  scrubTo,
  stepBy,
  stepFromKey,
} from "@ui-sdk/core/number";
import { definePrimitive } from "../define";
import {
  type ChangeDetails,
  type CommitDetails,
  flag,
  sourceOf,
  VISUALLY_HIDDEN,
} from "../shared";

export type { ChangeDetails, CommitDetails } from "../shared";

/** Which way a fader's travel runs. */
export type FaderOrientation = "horizontal" | "vertical";

/** The bottom of a fader's range unless given: -60, as for a level in dB. */
export const DEFAULT_MIN = -60;
/** The top of a fader's range unless given: 6. */
export const DEFAULT_MAX = 6;
/** A wheel movement smaller than this is ignored. */
const WHEEL_DELTA_EPSILON = 0.1;

export interface FaderPrimitiveOptions {
  /** Value the fill starts from, such as `0` on a -1 to 1 pan. Defaults to `min`. */
  anchor?: number;
  /** Uncontrolled starting value, and what a reset returns to; defaults to the midpoint. */
  defaultValue?: number;
  disabled?: boolean;
  /** How the value is written, e.g. `{ maximumFractionDigits: 1 }`. */
  format?: Intl.NumberFormatOptions;
  /** Step for Page Up, Page Down and Shift with the arrow keys. @default 10 */
  largeStep?: number;
  locale?: Intl.LocalesArgument;
  /** @default 6 */
  max?: number;
  /** @default -60 */
  min?: number;
  /** The form field's name, which the native input carries. */
  name?: string;
  onValueChange?: (value: number, details: ChangeDetails) => void;
  onValueCommitted?: (value: number, details: CommitDetails) => void;
  /** @default "vertical" */
  orientation?: FaderOrientation;
  /** @default 1 */
  step?: number;
  /** The controlled value; leave it out for the fader to hold its own. */
  value?: number;
}

export interface FaderState {
  anchor: number | undefined;
  defaultValue: number | undefined;
  disabled: boolean;
  /** Where a drag has taken the value, held until release so a controlled value that lags cannot pull the thumb back. */
  draft: number | null;
  dragging: boolean;
  format: Intl.NumberFormatOptions | undefined;
  /** Whether a label part names the fader. */
  labelled: boolean;
  largeStep: number;
  locale: Intl.LocalesArgument | undefined;
  max: number;
  min: number;
  name: string | undefined;
  orientation: FaderOrientation;
  step: number;
  /** The value the app holds, or the fader's own. */
  value: number;
}

/** What a view draws a fader from. */
export interface FaderSnapshot {
  anchor: number | undefined;
  disabled: boolean;
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

const range = (state: FaderState) => ({
  largeStep: state.largeStep,
  max: state.max,
  min: state.min,
  step: state.step,
});

/** The share of the travel `value` sits at, 0 to 100. */
const shareOf = (state: FaderState, value: number) =>
  fractionOf(value, state) * 100;

const resetValue = (state: FaderState) =>
  state.defaultValue ?? state.min + (state.max - state.min) / 2;

const onGrid = (state: FaderState, raw: number) =>
  scrubTo(raw, range(state)).value;

const displayed = (state: FaderState) =>
  state.draft ?? clamp(state.value, state.min, state.max);

const formatters = new Map<string, Intl.NumberFormat>();
function format(state: FaderState, value: number) {
  const key = JSON.stringify([state.locale, state.format]);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(state.locale, state.format);
    formatters.set(key, formatter);
  }
  return formatter.format(value);
}

const views = new WeakMap<FaderState, FaderSnapshot>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: FaderState): FaderSnapshot {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const value = displayed(state);
  const anchor = state.anchor ?? state.min;
  const view: FaderSnapshot = {
    anchor: state.anchor,
    disabled: state.disabled,
    dragging: state.dragging,
    fill: {
      from: shareOf(state, Math.min(anchor, value)),
      to: shareOf(state, Math.max(anchor, value)),
    },
    formatted: format(state, value),
    largeStep: state.largeStep,
    max: state.max,
    min: state.min,
    orientation: state.orientation,
    share: shareOf(state, value),
    step: state.step,
    value,
  };
  views.set(state, view);
  return view;
}

/** Whether `element` lays out right to left, which reverses a horizontal travel. */
function isRtl(element: Element) {
  const view = element.ownerDocument?.defaultView;
  return view ? view.getComputedStyle(element).direction === "rtl" : false;
}

/** The value under a point of the control, on the grid. */
function valueUnder(
  state: FaderState,
  control: HTMLElement,
  x: number,
  y: number
) {
  const box = control.getBoundingClientRect();
  const vertical = state.orientation === "vertical";
  let share = vertical
    ? (box.bottom - y) / (box.height || 1)
    : (x - box.left) / (box.width || 1);
  if (!vertical && isRtl(control)) {
    share = 1 - share;
  }
  return onGrid(
    state,
    state.min + clamp(share, 0, 1) * (state.max - state.min)
  );
}

/** One pointer gesture, from press to release. */
interface Gesture {
  pointerId: number;
  stop: () => void;
}

/** What the parts of a fader read: its state, drawn. */
export interface FaderPublicState {
  disabled: boolean;
  dragging: boolean;
  formatted: string;
  max: number;
  min: number;
  orientation: FaderOrientation;
  value: number;
}

const publicState = (state: FaderState): FaderPublicState => {
  const view = viewOf(state);
  return {
    disabled: view.disabled,
    dragging: view.dragging,
    formatted: view.formatted,
    max: view.max,
    min: view.min,
    orientation: view.orientation,
    value: view.value,
  };
};

/** The state attributes every part carries. */
const stateAttrs = (state: FaderState) => ({
  "data-disabled": flag(state.disabled),
  "data-dragging": flag(state.dragging),
  "data-orientation": state.orientation,
});

/** What a fader's `api` gives an adapter. */
export interface FaderApi {
  /** Handles a key on the fader's input: arrows, Page Up and Down, Home and End. Returns whether the fader took the key. */
  keyDown: (event: KeyboardEvent, element: Element) => boolean;
  /** Starts a pointer gesture on the control: a press on the track jumps to the value under it, a press on the thumb drags from where it was taken. */
  press: (
    event: PointerEvent,
    control: HTMLElement,
    thumb: HTMLElement | null
  ) => void;
  /** Returns to the default value, reporting a `"reset"` change and commit. */
  reset: (event?: Event) => void;
  /** Moves the fader to `value` from outside, as a property does: no change is reported. */
  set: (value: number) => void;
  /** Sets the value as typed: on the grid, reported and committed. */
  setValue: (value: number, event?: Event) => void;
  /** The value as displayed. */
  value: () => number;
  /** Listens to wheel steps on `element`; returns what removes the listener. */
  wheel: (element: HTMLElement) => () => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** The fader's slots, by name, with the props and the public state of each. */
export type FaderSlots = {
  control: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  indicator: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  input: SlotDefinition<
    FaderState,
    FaderApi,
    PartProps & {
      getAriaValueText?: (
        formatted: string,
        value: number,
        index: number
      ) => string;
    },
    object
  >;
  label: SlotDefinition<FaderState, FaderApi, PartProps, object>;
  mark: SlotDefinition<
    FaderState,
    FaderApi,
    PartProps & { value: number },
    FaderPublicState & { active: boolean }
  >;
  root: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  thumb: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  track: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
  value: SlotDefinition<FaderState, FaderApi, PartProps, FaderPublicState>;
};

/**
 * The type of `fader`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface FaderPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: FaderSlots;
  (
    initialOptions: FaderPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: FaderApi;
    get: () => FaderState;
    types: {
      api: FaderApi;
      options: FaderPrimitiveOptions;
      slots: FaderSlots;
      state: FaderState;
    };
  };
}

const inputOf = (el: HTMLElement | undefined) =>
  el?.querySelector<HTMLInputElement>('input[type="range"]') ?? undefined;

/** The state an options object asks for, with the defaults of the fader. */
function stateOf(options: FaderPrimitiveOptions) {
  return {
    anchor: options.anchor,
    defaultValue: options.defaultValue,
    disabled: options.disabled ?? false,
    format: options.format,
    largeStep: options.largeStep ?? 10,
    locale: options.locale,
    max: options.max ?? DEFAULT_MAX,
    min: options.min ?? DEFAULT_MIN,
    name: options.name,
    orientation: options.orientation ?? "vertical",
    step: options.step ?? 1,
  } satisfies Partial<FaderState>;
}

export const fader: FaderPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const change = createChange(context);
    const state = () => context.store.get() as FaderState;
    let gesture: Gesture | null = null;

    const commit = (value: number, reason: string, event?: Event) => {
      const source = sourceOf(event);
      dispatch(context, "onValueCommitted", value, {
        event,
        reason,
        ...(source ? { source } : {}),
      });
    };
    /** Reports a change and keeps it unless an app refused it; says whether it went through. */
    const report = (value: number, reason: string, event?: Event) => {
      const source = sourceOf(event);
      return change(
        "value",
        value as never,
        {
          event,
          reason,
          ...(source ? { source } : {}),
        } as never
      );
    };
    /** A change that is over as soon as it is made: keys, typed values, the wheel, a reset. */
    const setAtOnce = (value: number, reason: string, event?: Event) => {
      if (value !== displayed(state()) && report(value, reason, event)) {
        commit(value, reason, event);
      }
    };
    context.onDestroy(() => gesture?.stop());

    return {
      keyDown: (event: KeyboardEvent, element: Element) => {
        const current = state();
        if (current.disabled) {
          return false;
        }
        const move = stepFromKey(event, {
          dir: isRtl(element) ? "rtl" : "ltr",
          orientation: current.orientation,
        });
        if (!move) {
          return false;
        }
        const next = stepBy(displayed(current), move, range(current));
        setAtOnce(onGrid(current, next), "keyboard", event);
        return true;
      },
      press: (
        event: PointerEvent,
        control: HTMLElement,
        thumb: HTMLElement | null
      ) => {
        const current = state();
        if (current.disabled || event.button !== 0) {
          return;
        }
        if (gesture) {
          // Another finger does not take the gesture over; the same pointer
          // pressing again means its release was missed, so that drag ends here.
          if (gesture.pointerId !== event.pointerId) {
            return;
          }
          gesture.stop();
          gesture = null;
          context.store.set({ dragging: false, draft: null } as never);
        }
        const vertical = current.orientation === "vertical";
        const onThumb = Boolean(thumb?.contains(event.target as Node));
        // Taken by the thumb, the drag keeps the pointer where it grabbed it.
        let offset = 0;
        if (thumb && onThumb) {
          const box = thumb.getBoundingClientRect();
          offset = vertical
            ? event.clientY - (box.top + box.height / 2)
            : event.clientX - (box.left + box.width / 2);
        }
        let value = displayed(current);
        // Whether the gesture set a value, even one it later came back from.
        let changed = false;
        let moved = false;
        const set = (next: number, reason: string, source: Event) => {
          if (next !== value && report(next, reason, source)) {
            value = next;
            changed = true;
            context.store.set({ draft: next } as never);
          }
        };
        if (!onThumb) {
          set(
            valueUnder(current, control, event.clientX, event.clientY),
            "track-press",
            event
          );
        }
        context.store.set({ dragging: true } as never);
        const stop = bindDrag(control, event, {
          onEnd: (end) => {
            gesture = null;
            context.store.set({ dragging: false, draft: null } as never);
            if (changed) {
              commit(value, moved ? "drag" : "track-press", end);
            }
          },
          onMove: ({ event: move }) => {
            moved = true;
            set(
              valueUnder(
                state(),
                control,
                move.clientX - (vertical ? 0 : offset),
                move.clientY - (vertical ? offset : 0)
              ),
              "drag",
              move
            );
          },
        });
        gesture = { pointerId: event.pointerId, stop };
      },
      reset: (event?: Event) => {
        const current = state();
        if (current.disabled) {
          return;
        }
        setAtOnce(
          clamp(resetValue(current), current.min, current.max),
          "reset",
          event ?? new Event("reset")
        );
      },
      set: (value: number) => context.store.set({ value } as never),
      setValue: (value: number, event?: Event) =>
        setAtOnce(
          onGrid(state(), value),
          "input-change",
          event ?? new Event("change")
        ),
      value: () => displayed(state()),
      wheel: (element: HTMLElement) => {
        const handle = (event: WheelEvent) => {
          const current = state();
          if (current.disabled || event.ctrlKey || event.metaKey) {
            return;
          }
          event.preventDefault();
          if (Math.abs(event.deltaY) < WHEEL_DELTA_EPSILON) {
            return;
          }
          const next = stepBy(
            displayed(current),
            { direction: event.deltaY < 0 ? 1 : -1, size: "step" },
            range(current)
          );
          setAtOnce(onGrid(current, next), "wheel", event);
        };
        const listening = new AbortController();
        element.addEventListener("wheel", handle, {
          passive: false,
          signal: listening.signal,
        });
        return () => listening.abort();
      },
    };
  },
  controlled: ["value"],
  name: "fader",
  options: {
    anchor: "number",
    defaultValue: "number",
    disabled: "boolean",
    format: "value",
    largeStep: "number",
    locale: "value",
    max: "number",
    min: "number",
    name: "string",
    onValueChange: "callback",
    onValueCommitted: "callback",
    orientation: "string",
    step: "number",
    value: "number",
  },
  slots: (slot) => ({
    control: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => ({
        ...stateAttrs(state),
        style: css({ position: "relative", "touch-action": "none" }),
      }),
      bind: (el, part) => part.api.wheel(el),
      on: {
        // A double click, an Alt + click or Delete return to the default, as in a DAW.
        dblclick: (event, { api, el }) => {
          if (el) {
            api.reset(event);
          }
        },
        keydown: (event, { api }) => {
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            api.reset(event);
          }
        },
        pointerdown: (event, { api, el }) => {
          if (!el || event.button !== 0) {
            return;
          }
          event.preventDefault();
          if (event.altKey) {
            api.reset(event);
            return;
          }
          inputOf(el)?.focus({ preventScroll: true });
          api.press(
            event,
            el,
            el.querySelector<HTMLElement>('[data-slot="fader-thumb"]')
          );
        },
      },
      state: (state: FaderState) => publicState(state),
    }),
    indicator: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => {
        const { fill } = viewOf(state);
        const size = fill.to - fill.from;
        return {
          ...stateAttrs(state),
          style: css(
            state.orientation === "vertical"
              ? {
                  bottom: `${fill.from}%`,
                  height: `${size}%`,
                  width: "inherit",
                }
              : {
                  height: "inherit",
                  "inset-inline-start": `${fill.from}%`,
                  width: `${size}%`,
                }
          ),
        };
      },
      state: (state: FaderState) => publicState(state),
    }),
    // The native range input: the role, the value and the name live on it.
    input: slot<{
      getAriaValueText?: (
        formatted: string,
        value: number,
        index: number
      ) => string;
    }>({
      attrs: (state: FaderState, { id, props }) => {
        const view = viewOf(state);
        return {
          "aria-labelledby": state.labelled ? `${id}-label` : undefined,
          "aria-orientation": state.orientation,
          "aria-valuetext": props.getAriaValueText
            ? props.getAriaValueText(view.formatted, view.value, 0)
            : view.formatted,
          disabled: flag(state.disabled),
          max: String(state.max),
          min: String(state.min),
          name: state.name,
          step: String(state.step),
          style: css({
            ...VISUALLY_HIDDEN,
            height: "100%",
            width: "100%",
            ...(state.orientation === "vertical"
              ? { "writing-mode": "vertical-lr" }
              : {}),
          }),
          type: "range",
          value: String(view.value),
        };
      },
      on: {
        change: (event, { api, el }) =>
          api.setValue(Number((el as HTMLInputElement).value), event),
        input: (event, { api, el }) =>
          api.setValue(Number((el as HTMLInputElement).value), event),
        keydown: (event, { api, el }) => {
          if (el && api.keyDown(event, el)) {
            event.preventDefault();
          }
        },
      },
      props: { getAriaValueText: "value" },
    }),
    label: slot({
      attrs: (state: FaderState, { id }) => ({
        ...stateAttrs(state),
        id: `${id}-label`,
      }),
      bind: (_el, part) => {
        part.store.set({ labelled: true });
        return () => part.store.set({ labelled: false });
      },
    }),
    mark: slot<{ value: number }, FaderPublicState & { active: boolean }>({
      attrs: (state: FaderState, { props }) => {
        const at = shareOf(state, props.value);
        const { anchor, min, value } = viewOf(state);
        const from = anchor ?? min;
        const active =
          props.value >= Math.min(from, value) &&
          props.value <= Math.max(from, value);
        return {
          "aria-hidden": "true",
          "data-active": flag(active),
          "data-disabled": flag(state.disabled),
          "data-orientation": state.orientation,
          style: css({
            position: "absolute",
            ...(state.orientation === "vertical"
              ? { bottom: `${at}%` }
              : { "inset-inline-start": `${at}%` }),
          }),
        };
      },
      props: { value: "number" },
      state: (state: FaderState, { props }) => {
        const { anchor, min, value } = viewOf(state);
        const from = anchor ?? min;
        return {
          ...publicState(state),
          active:
            props.value >= Math.min(from, value) &&
            props.value <= Math.max(from, value),
        };
      },
    }),
    root: slot<object, FaderPublicState>({
      attrs: (state: FaderState, { id }) => ({
        ...stateAttrs(state),
        "aria-labelledby": state.labelled ? `${id}-label` : undefined,
        role: "group",
      }),
      state: (state: FaderState) => publicState(state),
    }),
    thumb: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => {
        const { share } = viewOf(state);
        const vertical = state.orientation === "vertical";
        return {
          ...stateAttrs(state),
          style: css({
            ...(vertical
              ? { bottom: `${share}%`, left: "50%", translate: "-50% 50%" }
              : {
                  "inset-inline-start": `${share}%`,
                  top: "50%",
                  translate: "-50% -50%",
                }),
            position: "absolute",
            ...(state.dragging ? { "z-index": "1" } : {}),
          }),
        };
      },
      state: (state: FaderState) => publicState(state),
    }),
    track: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => ({
        ...stateAttrs(state),
        style: css({ position: "relative" }),
      }),
      state: (state: FaderState) => publicState(state),
    }),
    value: slot<object, FaderPublicState>({
      attrs: (state: FaderState) => ({
        ...stateAttrs(state),
        "aria-live": "off",
      }),
      state: (state: FaderState) => publicState(state),
    }),
  }),
  state: (options: FaderPrimitiveOptions): FaderState => {
    const base = {
      ...stateOf(options),
      draft: null,
      dragging: false,
      labelled: false,
      value: 0,
    } satisfies FaderState;
    return {
      ...base,
      value: options.value ?? options.defaultValue ?? resetValue(base),
    };
  },
  sync: (options: FaderPrimitiveOptions) =>
    options.value === undefined
      ? stateOf(options)
      : { ...stateOf(options), value: options.value },
});
