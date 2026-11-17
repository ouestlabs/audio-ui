import {
  css,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import {
  clamp,
  fractionOf,
  numberFormatter,
  scrubTo,
} from "@ui-sdk/core/number";
import {
  type ChangeDetails,
  type CommitDetails,
  createGestures,
  createReporter,
  definePrimitive,
  flag,
  formatPair,
  VISUALLY_HIDDEN,
} from "../primitive";

export type { ChangeDetails, CommitDetails } from "../primitive";

/** A point on the pad, in the units of each axis. */
export interface XYPadPoint {
  x: number;
  y: number;
}

/** One of the pad's two axes. */
export type XYPadAxis = "x" | "y";

/** Shift with the arrows, and Page Up and Down, move this many steps at once. */
const LARGE_STEP_MULTIPLIER = 10;

export interface XYPadPrimitiveOptions {
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
  /** The form field's name: each axis input is `<name>.x` and `<name>.y`. */
  name?: string;
  onValueChange?: (value: XYPadPoint, details: ChangeDetails) => void;
  onValueCommitted?: (value: XYPadPoint, details: CommitDetails) => void;
  /** @default 1 */
  stepX?: number;
  /** @default 1 */
  stepY?: number;
  /** The controlled point; leave it out for the pad to hold its own. */
  value?: XYPadPoint;
}

export interface XYPadState {
  defaultValue: XYPadPoint | undefined;
  disabled: boolean;
  /** Where a drag has taken the point, held until release so a controlled point that lags cannot pull the pad back. */
  draft: XYPadPoint | null;
  dragging: boolean;
  format: Intl.NumberFormatOptions | undefined;
  /** Whether a label part names the pad. */
  labelled: boolean;
  locale: Intl.LocalesArgument | undefined;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  name: string | undefined;
  stepX: number;
  stepY: number;
  /** The point the app holds, or the pad's own. */
  value: XYPadPoint;
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
  /** Point position, 0 to 1 from the left. */
  percentX: number;
  /** Point position, 0 to 1 from the bottom. */
  percentY: number;
  stepX: number;
  stepY: number;
  /** The point as displayed: the dragged one while a pointer moves it. */
  value: XYPadPoint;
}

const axisOf = (state: XYPadState, axis: XYPadAxis) =>
  axis === "x"
    ? { max: state.maxX, min: state.minX, step: state.stepX }
    : { max: state.maxY, min: state.minY, step: state.stepY };

/** The center of the pad. */
const centerOf = (state: XYPadState): XYPadPoint => ({
  x: state.minX + (state.maxX - state.minX) / 2,
  y: state.minY + (state.maxY - state.minY) / 2,
});

/** What a reset returns to. */
const resetValue = (state: XYPadState) => state.defaultValue ?? centerOf(state);

/** Both axes snapped to their grid and clamped. */
const onGrid = (state: XYPadState, raw: XYPadPoint): XYPadPoint => ({
  x: scrubTo(raw.x, axisOf(state, "x")).value,
  y: scrubTo(raw.y, axisOf(state, "y")).value,
});

/** A coordinate inside its range, the low end when it is not a number. */
const within = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : min;

const displayed = (state: XYPadState): XYPadPoint =>
  state.draft ?? {
    x: within(state.value.x, state.minX, state.maxX),
    y: within(state.value.y, state.minY, state.maxY),
  };

const samePoint = (a: XYPadPoint, b: XYPadPoint) => a.x === b.x && a.y === b.y;

const views = new WeakMap<XYPadState, XYPadSnapshot>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: XYPadState): XYPadSnapshot {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const value = displayed(state);
  const formatter = numberFormatter(
    state.locale as string | undefined,
    state.format
  );
  const view: XYPadSnapshot = {
    disabled: state.disabled,
    dragging: state.dragging,
    formatted: { x: formatter.format(value.x), y: formatter.format(value.y) },
    formattedPair: formatPair(formatter, value.x, value.y),
    maxX: state.maxX,
    maxY: state.maxY,
    minX: state.minX,
    minY: state.minY,
    percentX: fractionOf(value.x, axisOf(state, "x")),
    percentY: fractionOf(value.y, axisOf(state, "y")),
    stepX: state.stepX,
    stepY: state.stepY,
    value,
  };
  views.set(state, view);
  return view;
}

/** The point under a pointer, in the pad's rectangle at the press. */
function pointUnder(
  state: XYPadState,
  rect: DOMRect,
  x: number,
  y: number
): XYPadPoint {
  const fromLeft = clamp((x - rect.left) / Math.max(rect.width, 1), 0, 1);
  const fromBottom = clamp((rect.bottom - y) / Math.max(rect.height, 1), 0, 1);
  return {
    x: state.minX + fromLeft * (state.maxX - state.minX),
    y: state.minY + fromBottom * (state.maxY - state.minY),
  };
}

/** The point a key moves to from `current`, or nothing for a key the pad does not take. */
function keyTarget(
  state: XYPadState,
  current: XYPadPoint,
  event: KeyboardEvent
): XYPadPoint | undefined {
  const multiplier = event.shiftKey ? LARGE_STEP_MULTIPLIER : 1;
  const dx = state.stepX * multiplier;
  const dy = state.stepY * multiplier;
  const largeDy = state.stepY * LARGE_STEP_MULTIPLIER;
  switch (event.key) {
    case "ArrowDown":
      return { x: current.x, y: current.y - dy };
    case "ArrowLeft":
      return { x: current.x - dx, y: current.y };
    case "ArrowRight":
      return { x: current.x + dx, y: current.y };
    case "ArrowUp":
      return { x: current.x, y: current.y + dy };
    case "End":
      return { x: state.maxX, y: current.y };
    case "Home":
      return { x: state.minX, y: current.y };
    case "PageDown":
      return { x: current.x, y: current.y - largeDy };
    case "PageUp":
      return { x: current.x, y: current.y + largeDy };
    default:
      return;
  }
}

/** One pointer gesture, from press to release. */
interface Gesture {
  /** Whether the gesture changed the point at least once; if so its end commits, even back on the start point. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  rect: DOMRect;
}

/** What a part's className, style and children functions read. */
export interface XYPadPublicState {
  disabled: boolean;
  dragging: boolean;
  formatted: { x: string; y: string };
  formattedPair: string;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  value: XYPadPoint;
}

const publicState = (state: XYPadState): XYPadPublicState => {
  const view = viewOf(state);
  return {
    disabled: view.disabled,
    dragging: view.dragging,
    formatted: view.formatted,
    formattedPair: view.formattedPair,
    maxX: view.maxX,
    maxY: view.maxY,
    minX: view.minX,
    minY: view.minY,
    value: view.value,
  };
};

/** Only `disabled` and `dragging` are data attributes; the numbers stay in the state. */
const stateAttrs = (state: XYPadState) => ({
  "data-disabled": flag(state.disabled),
  "data-dragging": flag(state.dragging),
});

/** What an XY pad's `api` gives an adapter. */
export interface XYPadApi {
  /**
   * Handles a key on one of the pad's inputs: arrows move by a step (Shift
   * for ten), Page Up and Down move the y axis by ten steps, Home and End go
   * to the ends of x, Delete or Backspace reset. Returns whether the pad took
   * the key.
   */
  keyDown: (event: KeyboardEvent) => boolean;
  /** Starts a pointer gesture on `control`: a press moves the point under the pointer, a drag follows it, and an Alt press resets it. */
  press: (event: PointerEvent, control: HTMLElement) => void;
  /** Returns to the default point, reporting a `"reset"` change and commit. */
  reset: (event?: Event) => void;
  /** Moves the pad to `point` from outside, as a property does: no change is reported. */
  set: (point: XYPadPoint) => void;
  /** Sets both axes as typed: on the grid, reported and committed. */
  setValue: (x: number, y: number, event?: Event) => void;
  /** Sets one axis as typed: on the grid, reported and committed. */
  type: (axis: XYPadAxis, value: number, event?: Event) => void;
  /** The point as displayed. */
  value: () => XYPadPoint;
  /** Listens to wheel and trackpad scrolling on `element`; returns what removes the listener. */
  wheel: (element: HTMLElement) => () => void;
}

/** The props every part takes. */
interface PartProps {
  id?: string;
}

/** What an axis input takes: how its value is announced. */
interface AxisInputProps extends PartProps {
  getAriaValueText?: (
    formatted: string,
    value: number,
    axis: XYPadAxis
  ) => string;
}

/** The pad's slots, by name, with the props and the public state of each. */
export type XYPadSlots = {
  control: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
  inputX: SlotDefinition<XYPadState, XYPadApi, AxisInputProps, object>;
  inputY: SlotDefinition<XYPadState, XYPadApi, AxisInputProps, object>;
  label: SlotDefinition<XYPadState, XYPadApi, PartProps, object>;
  root: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
  thumb: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
  value: SlotDefinition<XYPadState, XYPadApi, PartProps, XYPadPublicState>;
};

/**
 * The type of `xypad`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface XYPadPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: XYPadSlots;
  (
    initialOptions: XYPadPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: XYPadApi;
    get: () => XYPadState;
    types: {
      api: XYPadApi;
      options: XYPadPrimitiveOptions;
      slots: XYPadSlots;
      state: XYPadState;
    };
  };
}

/** The state an options object asks for, with the defaults of the pad. */
function stateOf(options: XYPadPrimitiveOptions) {
  return {
    defaultValue: options.defaultValue,
    disabled: options.disabled ?? false,
    format: options.format,
    locale: options.locale,
    maxX: options.maxX ?? 100,
    maxY: options.maxY ?? 100,
    minX: options.minX ?? 0,
    minY: options.minY ?? 0,
    name: options.name,
    stepX: options.stepX ?? 1,
    stepY: options.stepY ?? 1,
  } satisfies Partial<XYPadState>;
}

export const xypad: XYPadPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const { commit, report, setAtOnce, state } = createReporter(
      context,
      displayed,
      samePoint
    );
    const gestures = createGestures<Gesture>(context);
    /** A change of a point already on the grid that is over as soon as it is made. */
    const settle = (raw: XYPadPoint, reason: string, event?: Event) =>
      setAtOnce(onGrid(state(), raw), reason, event);
    /** Moves the point during a gesture; says whether it moved. */
    const drag = (raw: XYPadPoint, reason: string, event: PointerEvent) => {
      const next = onGrid(state(), raw);
      if (samePoint(next, displayed(state())) || !report(next, reason, event)) {
        return false;
      }
      context.store.set({ draft: next } as never);
      return true;
    };

    return {
      keyDown: (event: KeyboardEvent) => {
        const current = state();
        if (current.disabled) {
          return false;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          settle(resetValue(current), "reset", event);
          return true;
        }
        const target = keyTarget(current, displayed(current), event);
        if (!target) {
          return false;
        }
        settle(target, "keyboard", event);
        return true;
      },
      press: (event: PointerEvent, control: HTMLElement) => {
        if (
          state().disabled ||
          event.button !== 0 ||
          !gestures.accepts(event, () =>
            context.store.set({ dragging: false, draft: null } as never)
          )
        ) {
          return;
        }
        // Alt and a press returns to the default, as in a DAW.
        if (event.altKey) {
          settle(resetValue(state()), "reset", event);
          return;
        }
        const started: Gesture = {
          changed: false,
          moved: false,
          rect: control.getBoundingClientRect(),
        };
        context.store.set({ dragging: true } as never);
        started.changed = drag(
          pointUnder(state(), started.rect, event.clientX, event.clientY),
          "press",
          event
        );
        gestures.start(control, event, started, {
          onEnd: (end) => {
            const settled = displayed(state());
            context.store.set({ dragging: false, draft: null } as never);
            if (started.changed) {
              commit(settled, started.moved ? "drag" : "press", end);
            }
          },
          onMove: (move) => {
            started.moved = true;
            if (
              drag(
                pointUnder(state(), started.rect, move.clientX, move.clientY),
                "drag",
                move
              )
            ) {
              started.changed = true;
            }
          },
        });
      },
      reset: (event?: Event) =>
        settle(resetValue(state()), "reset", event ?? new Event("reset")),
      set: (point: XYPadPoint) => context.store.set({ value: point } as never),
      setValue: (x: number, y: number, event?: Event) =>
        settle({ x, y }, "input-change", event ?? new Event("change")),
      type: (axis: XYPadAxis, value: number, event?: Event) =>
        settle(
          { ...displayed(state()), [axis]: value },
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
          const rect = element.getBoundingClientRect();
          const point = displayed(current);
          // Trackpads scroll in two dimensions: the wheel moves the point by
          // the same distance a drag would.
          settle(
            {
              x:
                point.x +
                (event.deltaX * (current.maxX - current.minX)) /
                  Math.max(rect.width, 1),
              y:
                point.y -
                (event.deltaY * (current.maxY - current.minY)) /
                  Math.max(rect.height, 1),
            },
            "wheel",
            event
          );
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
  name: "xypad",
  options: {
    defaultValue: "value",
    disabled: "boolean",
    format: "value",
    locale: "value",
    maxX: "number",
    maxY: "number",
    minX: "number",
    minY: "number",
    name: "string",
    onValueChange: "callback",
    onValueCommitted: "callback",
    stepX: "number",
    stepY: "number",
    value: "value",
  },
  slots: (slot) => {
    const axisInput = (axis: XYPadAxis) =>
      slot<{
        getAriaValueText?: (
          formatted: string,
          value: number,
          axis: XYPadAxis
        ) => string;
      }>({
        attrs: (state: XYPadState, { id, props }) => {
          const view = viewOf(state);
          const value = view.value[axis];
          const formatted = view.formatted[axis];
          const { max, min, step } = axisOf(state, axis);
          return {
            "aria-labelledby": state.labelled ? `${id}-label` : undefined,
            "aria-orientation": axis === "x" ? "horizontal" : "vertical",
            "aria-valuetext": props.getAriaValueText
              ? props.getAriaValueText(formatted, value, axis)
              : formatted,
            disabled: flag(state.disabled),
            max: String(max),
            min: String(min),
            name:
              state.name === undefined ? undefined : `${state.name}.${axis}`,
            step: String(step),
            style: css(VISUALLY_HIDDEN),
            // Only the X input is in the tab order: its keys move both axes.
            tabindex: axis === "x" ? undefined : "-1",
            type: "range",
            value: String(value),
          };
        },
        on: {
          change: (event, { api, el }) =>
            api.type(axis, Number((el as HTMLInputElement).value), event),
          input: (event, { api, el }) =>
            api.type(axis, Number((el as HTMLInputElement).value), event),
          keydown: (event, { api }) => {
            if (api.keyDown(event)) {
              event.preventDefault();
            }
          },
        },
        // A formatter, read for its result: "callback" would make it an event in Vue.
        props: { getAriaValueText: "value" },
      });

    return {
      control: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => ({
          ...stateAttrs(state),
          style: css({ position: "relative", "touch-action": "none" }),
        }),
        bind: (el, part) => part.api.wheel(el),
        on: {
          // A double click, an Alt press or Delete return to the default, as in a DAW.
          dblclick: (event, { api, store }) => {
            if (!store.get().disabled) {
              api.reset(event);
            }
          },
          pointerdown: (event, { api, el, store }) => {
            if (!el || store.get().disabled || event.button !== 0) {
              return;
            }
            event.preventDefault();
            el.querySelector<HTMLInputElement>('input[type="range"]')?.focus({
              focusVisible: false,
              preventScroll: true,
            } as FocusOptions);
            api.press(event, el);
          },
        },
        state: (state: XYPadState) => publicState(state),
      }),
      inputX: axisInput("x"),
      inputY: axisInput("y"),
      // Names the pad's inputs, when the thumb does not.
      label: slot({
        attrs: (state: XYPadState, { id }) => ({
          ...stateAttrs(state),
          id: `${id}-label`,
        }),
        bind: (_el, part) => {
          part.store.set({ labelled: true });
          return () => part.store.set({ labelled: false });
        },
      }),
      root: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => {
          const view = viewOf(state);
          return {
            ...stateAttrs(state),
            style: css({
              "--xy-pad-x": `${view.percentX * 100}%`,
              "--xy-pad-y": `${100 - view.percentY * 100}%`,
            }),
          };
        },
        state: (state: XYPadState) => publicState(state),
      }),
      thumb: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => {
          const view = viewOf(state);
          return {
            ...stateAttrs(state),
            style: css({
              left: `${view.percentX * 100}%`,
              top: `${100 - view.percentY * 100}%`,
              translate: "-50% -50%",
            }),
          };
        },
        state: (state: XYPadState) => publicState(state),
      }),
      value: slot<object, XYPadPublicState>({
        attrs: (state: XYPadState) => ({
          ...stateAttrs(state),
          "aria-live": "off",
        }),
        state: (state: XYPadState) => publicState(state),
      }),
    };
  },
  state: (options: XYPadPrimitiveOptions): XYPadState => {
    const base = {
      ...stateOf(options),
      draft: null,
      dragging: false,
      labelled: false,
      value: { x: 0, y: 0 },
    } satisfies XYPadState;
    return {
      ...base,
      value: options.value ?? options.defaultValue ?? centerOf(base),
    };
  },
  sync: (options: XYPadPrimitiveOptions) =>
    options.value === undefined
      ? stateOf(options)
      : { ...stateOf(options), value: options.value },
});