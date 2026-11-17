import {
  css,
  type PrimitiveInstance,
  type PropSpec,
  type SlotDefinition,
} from "@ui-sdk/core";
import {
  clamp,
  fractionOf,
  type NumberScale,
  numberFormatter,
  scrubTo,
  stepBy,
  stepFromKey,
  valueAt,
} from "@ui-sdk/core/number";
import {
  type ChangeDetails,
  type CommitDetails,
  createGestures,
  createReporter,
  definePrimitive,
  flag,
  VISUALLY_HIDDEN,
} from "../primitive";

/** How a drag turns a knob: up and down, around its centre, or by the turns of the pointer. */
export type KnobDragMode = "circular" | "revolution" | "vertical";

/** Center of the 48 by 48 viewBox the arcs are drawn in. */
const VIEWBOX_CENTER = 24;
/** Gap at the bottom of the dial: the sweep runs clockwise from bottom-left to bottom-right. */
const ANGLE_GAP_RAD = Math.PI / 5;
const TAU = Math.PI * 2;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
/** Rotation at `min`, in degrees clockwise from 12 o'clock. */
export const START_ANGLE = 90 + toDegrees(Math.PI / 2 + ANGLE_GAP_RAD);
/** Rotation travelled from `min` to `max`, in degrees. */
export const SWEEP_ANGLE = toDegrees(TAU - 2 * ANGLE_GAP_RAD);
/** Outer edge of the arcs in the viewBox; each stroke is centered inside it. */
const ARC_OUTER_RADIUS = 23;
/** The width of the track and indicator arcs in the 48 by 48 view box, unless given. */
export const DEFAULT_ARC_STROKE_WIDTH = 3;
/** Vertical drag: pointer travel, in px, for the whole `min` to `max` range. */
const VERTICAL_DRAG_RANGE_PX = 150;
/** Circular drag: inside this fraction of the diameter the angle is synced but not accumulated, so crossing the hub does not jump. */
const CENTER_DEAD_ZONE_REL = 0.08;
/** The smallest the hub's dead zone may be, in px, however small the knob. */
const CENTER_DEAD_ZONE_MIN_PX = 2;
/** A press that moves less than this is a tap; two quick taps reset the value. */
const TAP_MAX_MOVE_PX = 12;
/** The longest two taps may be apart, in ms, to count as a double tap. */
const DOUBLE_TAP_MAX_MS = 320;
/** A wheel movement smaller than this is ignored. */
const WHEEL_DELTA_EPSILON = 0.1;
/** Holding Shift turns the knob this much slower than the pointer moves. */
const FINE_DRAG = 0.25;
/** On a scale that is not linear, a key or wheel notch moves this share of the travel. */
const POSITION_STEP = 0.01;
/** On a scale that is not linear, a large step moves this share of the travel. */
const LARGE_POSITION_STEP = 0.1;

export interface KnobPrimitiveOptions {
  /** Value the indicator arc grows from, such as `0` on a -1 to 1 pan. Defaults to `min`. */
  anchor?: number;
  /** Uncontrolled starting value, and what a reset returns to; defaults to the middle of the travel. */
  defaultValue?: number;
  disabled?: boolean;
  /** @default "circular" */
  dragMode?: KnobDragMode;
  /** How the value is written, e.g. `{ maximumFractionDigits: 1 }`. */
  format?: Intl.NumberFormatOptions;
  /** Step for Page Up, Page Down and Shift with the arrow keys. @default 10 */
  largeStep?: number;
  locale?: Intl.LocalesArgument;
  /** @default 100 */
  max?: number;
  /** @default 0 */
  min?: number;
  /** The form field's name, which the native input carries. */
  name?: string;
  onValueChange?: (value: number, details: ChangeDetails) => void;
  onValueCommitted?: (value: number, details: CommitDetails) => void;
  /** `"linear"`, `"log"`, or a `{ to, from }` pair that maps values into an even space and back. @default "linear" */
  scale?: NumberScale;
  /** @default 1 */
  step?: number;
  /** The controlled value; leave it out for the knob to hold its own. */
  value?: number;
}

export interface KnobState {
  anchor: number | undefined;
  defaultValue: number | undefined;
  disabled: boolean;
  /** Where a drag has taken the value, held until release so a controlled value that lags cannot pull the knob back. */
  draft: number | null;
  dragging: boolean;
  dragMode: KnobDragMode;
  format: Intl.NumberFormatOptions | undefined;
  /** Whether a label part names the knob. */
  labelled: boolean;
  largeStep: number;
  locale: Intl.LocalesArgument | undefined;
  max: number;
  min: number;
  name: string | undefined;
  scale: NumberScale;
  step: number;
  /** The value the app holds, or the knob's own. */
  value: number;
}

/** What a view draws a knob from. */
export interface KnobSnapshot {
  anchor: number | undefined;
  /** Indicator arc origin, 0 to 1 along the sweep. */
  anchorPercent: number;
  /** Rotation in degrees, clockwise from 12 o'clock. */
  angle: number;
  disabled: boolean;
  dragging: boolean;
  dragMode: KnobDragMode;
  /** The value as text, with `format` and `locale`. */
  formatted: string;
  largeStep: number;
  max: number;
  min: number;
  /** Value position, 0 to 1 along the sweep. */
  percent: number;
  scale: NumberScale;
  step: number;
  /** The value as displayed: the dragged one while a pointer turns the knob. */
  value: number;
}

const range = (state: {
  largeStep?: number;
  max: number;
  min: number;
  step: number;
}) => ({
  largeStep: state.largeStep,
  max: state.max,
  min: state.min,
  step: state.step,
});

/** The value a fresh knob holds: the middle of its travel, on its scale and its grid. */
function middleOf(state: KnobState) {
  return scrubTo(valueAt(0.5, state, state.scale), range(state)).value;
}

/** What a reset returns to. */
const resetValue = (state: KnobState) => state.defaultValue ?? middleOf(state);

const onGrid = (state: KnobState, raw: number) =>
  scrubTo(raw, range(state)).value;

const displayed = (state: KnobState) =>
  state.draft ?? clamp(state.value, state.min, state.max);

export type { ChangeDetails, CommitDetails } from "../primitive";

const views = new WeakMap<KnobState, KnobSnapshot>();

/** What the parts draw from `state`, worked out once per state. */
export function viewOf(state: KnobState): KnobSnapshot {
  const cached = views.get(state);
  if (cached) {
    return cached;
  }
  const value = displayed(state);
  const percent = fractionOf(value, state, state.scale);
  const view: KnobSnapshot = {
    anchor: state.anchor,
    anchorPercent:
      state.anchor === undefined
        ? 0
        : fractionOf(state.anchor, state, state.scale),
    angle: START_ANGLE + percent * SWEEP_ANGLE,
    disabled: state.disabled,
    dragMode: state.dragMode,
    dragging: state.dragging,
    formatted: numberFormatter(
      state.locale as string | undefined,
      state.format
    ).format(value),
    largeStep: state.largeStep,
    max: state.max,
    min: state.min,
    percent,
    scale: state.scale,
    step: state.step,
    value,
  };
  views.set(state, view);
  return view;
}

/**
 * The value one notch from `current`: a step on a linear scale, a share of
 * the travel on any other, and always at least one step.
 */
function notch(
  state: KnobState,
  current: number,
  direction: -1 | 1,
  large: boolean
) {
  if (state.scale === "linear") {
    return stepBy(
      current,
      { direction, size: large ? "large" : "step" },
      range(state)
    );
  }
  const position =
    fractionOf(current, state, state.scale) +
    direction * (large ? LARGE_POSITION_STEP : POSITION_STEP);
  const next = valueAt(clamp(position, 0, 1), state, state.scale);
  return Math.abs(next - current) < state.step
    ? current + direction * state.step
    : next;
}

/** The `d` of an arc along the dial between two positions, 0 to 1. */
function arcPath(radius: number, from: number, to: number) {
  const point = (t: number) => {
    const angle = ((START_ANGLE + t * SWEEP_ANGLE - 90) * Math.PI) / 180;
    return {
      x: VIEWBOX_CENTER + radius * Math.cos(angle),
      y: VIEWBOX_CENTER + radius * Math.sin(angle),
    };
  };
  const start = point(from);
  const end = point(to);
  const largeArc = (to - from) * SWEEP_ANGLE > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** The `d` of an arc from `from` to `to` along the sweep, or null when there is none to draw. */
export function arcOf(strokeWidth: number, from: number, to: number) {
  return Math.abs(to - from) > 0.001
    ? arcPath(ARC_OUTER_RADIUS - strokeWidth / 2, from, to)
    : null;
}

/** Where the indicator's arc runs: from the anchor to the value, either way. */
export const indicatorSpan = (view: KnobSnapshot) =>
  [
    Math.min(view.anchorPercent, view.percent),
    Math.max(view.anchorPercent, view.percent),
  ] as const;

/** The angle of a pointer around the centre of `rect`, in radians, 0 pointing right. */
const pointerAngle = (x: number, y: number, rect: DOMRect) =>
  Math.atan2(
    y - (rect.top + rect.height / 2),
    x - (rect.left + rect.width / 2)
  );

/** One pointer drag, from press to release. */
interface Gesture {
  /** Whether the gesture changed the value at least once; if so its end commits, even back on the start value. */
  changed: boolean;
  lastAngle: number;
  lastY: number;
  /** Farthest distance from the press point, in px. */
  maxDistance: number;
  /** How far the drag has taken the dial, 0 to 1 and beyond, accumulated so Shift can make any stretch finer. */
  position: number;
  rect: DOMRect;
  startX: number;
  startY: number;
}

/** The value a gesture has turned the knob to, after one pointer move. */
function turn(state: KnobState, gesture: Gesture, event: PointerEvent) {
  const speed = event.shiftKey ? FINE_DRAG : 1;
  if (state.dragMode === "vertical") {
    gesture.position +=
      ((gesture.lastY - event.clientY) / VERTICAL_DRAG_RANGE_PX) * speed;
  } else {
    const { rect } = gesture;
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
      let delta = angle - gesture.lastAngle;
      if (delta > Math.PI) {
        delta -= TAU;
      } else if (delta < -Math.PI) {
        delta += TAU;
      }
      const fullTurn =
        state.dragMode === "revolution" ? TAU : (SWEEP_ANGLE * Math.PI) / 180;
      gesture.position += (delta / fullTurn) * speed;
    }
    gesture.lastAngle = angle;
  }
  gesture.lastY = event.clientY;
  return valueAt(clamp(gesture.position, 0, 1), state, state.scale);
}

/** What the parts of a knob read: its state, drawn. */
export interface KnobPublicState {
  disabled: boolean;
  dragging: boolean;
  dragMode: KnobDragMode;
  formatted: string;
  max: number;
  min: number;
  value: number;
}

/** What the arcs read: the knob's state and the `d` of their path. */
export interface ArcState extends KnobPublicState {
  arc: string | null;
}

const publicState = (state: KnobState): KnobPublicState => {
  const view = viewOf(state);
  return {
    disabled: view.disabled,
    dragging: view.dragging,
    dragMode: view.dragMode,
    formatted: view.formatted,
    max: view.max,
    min: view.min,
    value: view.value,
  };
};

/** The state attributes every part carries. */
const stateAttrs = (state: KnobState) => ({
  "data-disabled": flag(state.disabled),
  "data-drag-mode": state.dragMode,
  "data-dragging": flag(state.dragging),
});

/** What a knob's `api` gives an adapter. */
export interface KnobApi {
  /** Handles a key on the knob's input: arrows, Page Up and Down, Home, End, Delete or Backspace to reset. Returns whether the knob took the key. */
  keyDown: (event: KeyboardEvent) => boolean;
  /** Starts a pointer gesture on `control`: a drag turns the knob, a double tap or an Alt press resets it. */
  press: (event: PointerEvent, control: HTMLElement) => void;
  /** Returns to the default value, reporting a `"reset"` change and commit. */
  reset: (event?: Event) => void;
  /** Moves the knob to `value` from outside, as a property does: no change is reported. */
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

/** The knob's slots, by name, with the props and the public state of each. */
export type KnobSlots = {
  control: SlotDefinition<KnobState, KnobApi, PartProps, KnobPublicState>;
  indicator: SlotDefinition<
    KnobState,
    KnobApi,
    PartProps & { strokeWidth?: number },
    ArcState
  >;
  input: SlotDefinition<
    KnobState,
    KnobApi,
    PartProps & {
      getAriaValueText?: (formatted: string, value: number) => string;
    },
    object
  >;
  label: SlotDefinition<KnobState, KnobApi, PartProps, object>;
  mark: SlotDefinition<
    KnobState,
    KnobApi,
    PartProps & { value: number },
    KnobPublicState
  >;
  root: SlotDefinition<KnobState, KnobApi, PartProps, KnobPublicState>;
  thumb: SlotDefinition<KnobState, KnobApi, PartProps, KnobPublicState>;
  track: SlotDefinition<
    KnobState,
    KnobApi,
    PartProps & { strokeWidth?: number },
    ArcState
  >;
  value: SlotDefinition<KnobState, KnobApi, PartProps, KnobPublicState>;
};

/**
 * The type of `knob`, written out: the kernel's own types its inferred type
 * would name are not exported, so a declaration could not print it.
 */
export interface KnobPrimitive {
  options: Record<string, PropSpec> | undefined;
  slots: KnobSlots;
  (
    initialOptions: KnobPrimitiveOptions & { id: string }
  ): Omit<PrimitiveInstance, "api" | "get" | "types"> & {
    api: KnobApi;
    get: () => KnobState;
    types: {
      api: KnobApi;
      options: KnobPrimitiveOptions;
      slots: KnobSlots;
      state: KnobState;
    };
  };
}

/** The state an options object asks for, with the defaults of the knob. */
function stateOf(options: KnobPrimitiveOptions) {
  return {
    anchor: options.anchor,
    defaultValue: options.defaultValue,
    disabled: options.disabled ?? false,
    dragMode: options.dragMode ?? "circular",
    format: options.format,
    largeStep: options.largeStep ?? 10,
    locale: options.locale,
    max: options.max ?? 100,
    min: options.min ?? 0,
    name: options.name,
    scale: options.scale ?? "linear",
    step: options.step ?? 1,
  } satisfies Partial<KnobState>;
}

export const knob: KnobPrimitive = definePrimitive({
  agent: { actions: ["setValue"] },
  api: (context) => {
    const { commit, report, setAtOnce, state } = createReporter(
      context,
      displayed
    );
    const gestures = createGestures<Gesture>(context);
    let lastTapAt = 0;

    /** Ends a gesture: a tap that moved little is a tap, and a second one soon after resets. */
    const finish = (end: PointerEvent, ended: Gesture, allowTap: boolean) => {
      const turned = displayed(state());
      context.store.set({ dragging: false, draft: null } as never);
      if (allowTap && ended.maxDistance <= TAP_MAX_MOVE_PX) {
        const now = performance.now();
        const isDoubleTap = now - lastTapAt <= DOUBLE_TAP_MAX_MS;
        lastTapAt = isDoubleTap ? 0 : now;
        if (isDoubleTap) {
          setAtOnce(resetValue(state()), "reset", end);
        }
        return;
      }
      lastTapAt = 0;
      if (ended.changed) {
        commit(turned, "drag", end);
      }
    };

    return {
      keyDown: (event: KeyboardEvent) => {
        const current = state();
        if (current.disabled) {
          return false;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          setAtOnce(resetValue(current), "reset", event);
          return true;
        }
        const move = stepFromKey(event);
        if (!move) {
          return false;
        }
        const value = displayed(current);
        let target: number;
        if ("bound" in move && move.bound) {
          target = move.bound === "min" ? current.min : current.max;
        } else if (move.direction) {
          target = notch(current, value, move.direction, move.size === "large");
        } else {
          return false;
        }
        setAtOnce(onGrid(current, target), "keyboard", event);
        return true;
      },
      press: (event: PointerEvent, control: HTMLElement) => {
        if (
          state().disabled ||
          !gestures.accepts(event, (stale) => finish(event, stale, false))
        ) {
          return;
        }
        const current = state();
        // Alt and a press returns to the default, as in a DAW.
        if (event.altKey) {
          setAtOnce(resetValue(current), "reset", event);
          return;
        }
        const rect = control.getBoundingClientRect();
        const started: Gesture = {
          changed: false,
          lastAngle: pointerAngle(event.clientX, event.clientY, rect),
          lastY: event.clientY,
          maxDistance: 0,
          position: fractionOf(displayed(current), current, current.scale),
          rect,
          startX: event.clientX,
          startY: event.clientY,
        };
        context.store.set({ dragging: true } as never);
        gestures.start(control, event, started, {
          onEnd: (end, ended, canceled) => finish(end, ended, !canceled),
          onMove: (move) => {
            started.maxDistance = Math.max(
              started.maxDistance,
              Math.hypot(
                move.clientX - started.startX,
                move.clientY - started.startY
              )
            );
            const now = state();
            const next = onGrid(now, turn(now, started, move));
            if (report(next, "drag", move)) {
              started.changed = true;
              context.store.set({ draft: next } as never);
            }
          },
        });
      },
      reset: (event?: Event) =>
        setAtOnce(
          onGrid(state(), resetValue(state())),
          "reset",
          event ?? new Event("reset")
        ),
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
          const next = notch(
            current,
            displayed(current),
            event.deltaY < 0 ? 1 : -1,
            false
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
  name: "knob",
  options: {
    anchor: "number",
    defaultValue: "number",
    disabled: "boolean",
    dragMode: "string",
    format: "value",
    largeStep: "number",
    locale: "value",
    max: "number",
    min: "number",
    name: "string",
    onValueChange: "callback",
    onValueCommitted: "callback",
    scale: "value",
    step: "number",
    value: "number",
  },
  slots: (slot) => ({
    control: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state),
        style: css({ position: "relative", "touch-action": "none" }),
      }),
      bind: (el, part) => part.api.wheel(el),
      on: {
        pointerdown: (event, { api, el }) => {
          if (el) {
            api.press(event, el);
          }
        },
      },
      state: (state: KnobState) => publicState(state),
    }),
    indicator: slot<{ strokeWidth?: number }, ArcState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state),
        "aria-hidden": "true",
        viewBox: "0 0 48 48",
      }),
      props: { strokeWidth: "number" },
      state: (state: KnobState, { props }) => ({
        ...publicState(state),
        arc: arcOf(
          props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH,
          ...indicatorSpan(viewOf(state))
        ),
      }),
    }),
    // The native range input: the role, the value and the name live on it.
    input: slot<{
      getAriaValueText?: (formatted: string, value: number) => string;
    }>({
      attrs: (state: KnobState, { id, props }) => {
        const view = viewOf(state);
        return {
          "aria-labelledby": state.labelled ? `${id}-label` : undefined,
          "aria-valuetext": props.getAriaValueText
            ? props.getAriaValueText(view.formatted, view.value)
            : view.formatted,
          disabled: flag(state.disabled),
          max: String(state.max),
          min: String(state.min),
          name: state.name,
          step: String(state.step),
          style: css(VISUALLY_HIDDEN),
          type: "range",
          value: String(view.value),
        };
      },
      on: {
        change: (event, { api, el }) =>
          api.setValue(Number((el as HTMLInputElement).value), event),
        input: (event, { api, el }) =>
          api.setValue(Number((el as HTMLInputElement).value), event),
        keydown: (event, { api }) => {
          if (api.keyDown(event)) {
            event.preventDefault();
          }
        },
      },
      // A formatter, read for its result: "callback" would make it an event in Vue.
      props: { getAriaValueText: "value" },
    }),
    // Names the knob's input, when nothing else does.
    label: slot({
      attrs: (state: KnobState, { id }) => ({
        ...stateAttrs(state),
        id: `${id}-label`,
      }),
      bind: (_el, part) => {
        part.store.set({ labelled: true });
        return () => part.store.set({ labelled: false });
      },
    }),
    mark: slot<{ value: number }, KnobPublicState>({
      attrs: (state: KnobState, { props }) => {
        const view = viewOf(state);
        const position = fractionOf(props.value, state, state.scale);
        const angle = START_ANGLE + position * SWEEP_ANGLE;
        const [lower, upper] = indicatorSpan(view);
        return {
          ...stateAttrs(state),
          "aria-hidden": "true",
          "data-active": flag(
            position >= lower - 1e-9 && position <= upper + 1e-9
          ),
          style: css({
            "--knob-mark-angle": `${angle}deg`,
            inset: "0",
            "pointer-events": "none",
            position: "absolute",
            rotate: `${angle}deg`,
          }),
        };
      },
      props: { value: "number" },
      state: (state: KnobState) => publicState(state),
    }),
    root: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => stateAttrs(state),
      state: (state: KnobState) => publicState(state),
    }),
    thumb: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state),
        style: css({ rotate: `${viewOf(state).angle}deg` }),
      }),
      state: (state: KnobState) => publicState(state),
    }),
    track: slot<{ strokeWidth?: number }, ArcState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state),
        "aria-hidden": "true",
        viewBox: "0 0 48 48",
      }),
      props: { strokeWidth: "number" },
      state: (state: KnobState, { props }) => ({
        ...publicState(state),
        arc: arcOf(props.strokeWidth ?? DEFAULT_ARC_STROKE_WIDTH, 0, 1),
      }),
    }),
    value: slot<object, KnobPublicState>({
      attrs: (state: KnobState) => ({
        ...stateAttrs(state),
        "aria-live": "off",
      }),
      state: (state: KnobState) => publicState(state),
    }),
  }),
  state: (options: KnobPrimitiveOptions): KnobState => {
    const rest = stateOf(options);
    const base = {
      ...rest,
      draft: null,
      dragging: false,
      labelled: false,
      value: 0,
    } satisfies KnobState;
    return {
      ...base,
      value: options.value ?? options.defaultValue ?? middleOf(base),
    };
  },
  sync: (options: KnobPrimitiveOptions) =>
    options.value === undefined
      ? stateOf(options)
      : { ...stateOf(options), value: options.value },
});