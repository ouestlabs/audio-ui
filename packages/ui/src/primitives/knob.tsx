import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { useWheel } from "../hooks/interactions/use-wheel";
import {
  clamp,
  degToRad,
  type Nullable,
  PI_HALF,
  type Point,
  radToDeg,
  roundToStep,
  TAU,
} from "../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "./internal/event-details";
import { type PartProps, resolveStyling } from "./internal/part";

/** Center of the 48×48 viewBox the arcs are drawn in. */
const VIEWBOX_CENTER = 24;
/** Gap at the bottom of the dial: the sweep runs clockwise from bottom-left to bottom-right. */
const ANGLE_GAP_RAD = Math.PI / 5;
/** Rotation at `min`, in degrees clockwise from 12 o'clock. */
const START_ANGLE = 90 + radToDeg(PI_HALF + ANGLE_GAP_RAD);
/** Rotation travelled from `min` to `max`, in degrees. */
const SWEEP_ANGLE = radToDeg(TAU - 2 * ANGLE_GAP_RAD);
/** Outer edge of the arcs in the viewBox; each stroke is centered inside it. */
const ARC_OUTER_RADIUS = 23;
const DEFAULT_ARC_STROKE_WIDTH = 3;
/** Vertical drag: pointer travel, in px, for the whole `min…max` range. */
const VERTICAL_DRAG_RANGE_PX = 150;
/** Circular drag: inside this fraction of the diameter the angle is synced but not accumulated, so crossing the hub doesn't jump. */
const CENTER_DEAD_ZONE_REL = 0.08;
const CENTER_DEAD_ZONE_MIN_PX = 2;
/** A press that moves less than this is a tap; two quick taps reset the value. */
const TAP_MAX_MOVE_PX = 12;
const DOUBLE_TAP_MAX_MS = 320;
const WHEEL_DELTA_EPSILON = 0.1;

const VISUALLY_HIDDEN: React.CSSProperties = {
  border: 0,
  clipPath: "inset(50%)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
};

/** Only `disabled` and `dragging` become data attributes; the numbers stay in `state`. */
const STATE_ATTRIBUTES_MAPPING = {
  max: () => null,
  min: () => null,
  value: () => null,
};

function toPercent(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min || 1), 0, 1);
}

/** SVG arc along the dial between two normalized positions (0…1). */
function arcPath(radius: number, from: number, to: number): string {
  const point = (t: number) => {
    const angle = degToRad(START_ANGLE + t * SWEEP_ANGLE - 90);
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

function pointerAngle(clientX: number, clientY: number, rect: DOMRect): number {
  return Math.atan2(
    clientY - (rect.top + rect.height / 2),
    clientX - (rect.left + rect.width / 2)
  );
}

interface KnobContextValue {
  actions: {
    /** Snap, clamp and propose a value; returns whether it was applied. */
    change: (next: number, eventDetails: Root.ChangeEventDetails) => boolean;
    commit: (value: number, eventDetails: Root.CommitEventDetails) => void;
    setDragging: (dragging: boolean) => void;
  };
  meta: {
    /** Indicator arc origin, 0…1 along the sweep. */
    anchorPercent: number;
    /** Rotation in degrees, clockwise from 12 o'clock. */
    angle: number;
    dragMode: Root.DragMode;
    form: string | undefined;
    formatter: Intl.NumberFormat;
    inputId: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    labelId: string | undefined;
    largeStep: number;
    name: string | undefined;
    /** Value position, 0…1 along the sweep. */
    percent: number;
    resetValue: number;
    setLabelId: (id: string | undefined) => void;
    step: number;
    /** Latest displayed value, readable from event handlers. */
    valueRef: React.RefObject<number>;
    wheelRef: (node: Nullable<HTMLElement>) => void;
  };
  state: Root.State;
}

const KnobContext = React.createContext<KnobContextValue | null>(null);

function useKnobContext(part: string): KnobContextValue {
  const context = React.use(KnobContext);
  if (!context) {
    throw new Error(`Knob.${part} must be used within Knob.Root`);
  }
  return context;
}

/**
 * Groups all parts of the knob and owns its value. Dragging the `Control`,
 * turning the mouse wheel over it, the keyboard on the `Thumb`'s input, or a
 * double tap (reset) all report through `onValueChange` / `onValueCommitted`.
 * Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    anchor,
    className,
    defaultValue,
    disabled = false,
    dragMode = "circular",
    form,
    format,
    largeStep = 10,
    locale,
    max = 100,
    min = 0,
    name,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    step = 1,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;

  const resetValue = defaultValue ?? min + (max - min) / 2;
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(resetValue);
  const value = clamp(isControlled ? valueProp : uncontrolledValue, min, max);

  // While dragging, the knob follows the pointer even if a controlled value
  // lags behind; on release the controlled value rules again.
  const [dragging, setDraggingState] = React.useState(false);
  const [dragValue, setDragValue] = React.useState<number | null>(null);
  const draggingRef = React.useRef(false);
  const displayedValue = dragValue ?? value;
  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;

  const setDragging = React.useCallback((next: boolean) => {
    draggingRef.current = next;
    setDraggingState(next);
    if (!next) {
      setDragValue(null);
    }
  }, []);

  const change = React.useCallback(
    (raw: number, eventDetails: Root.ChangeEventDetails) => {
      const next = clamp(roundToStep(raw, step, min), min, max);
      if (next === valueRef.current) {
        return false;
      }
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      valueRef.current = next;
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (isControlled && draggingRef.current) {
        setDragValue(next);
      }
      return true;
    },
    [isControlled, max, min, onValueChange, step]
  );

  const commit = React.useCallback(
    (committed: number, eventDetails: Root.CommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  const { wheelRef } = useWheel({
    disabled,
    onWheel: (event: WheelEvent, delta: Point) => {
      if (Math.abs(delta.y) < WHEEL_DELTA_EPSILON) {
        return;
      }
      const next = valueRef.current + (delta.y < 0 ? step : -step);
      if (change(next, createChangeEventDetails("wheel", event))) {
        commit(valueRef.current, { event, reason: "wheel" });
      }
    },
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const [labelId, setLabelId] = React.useState<string>();
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(locale, format),
    [format, locale]
  );

  const state = React.useMemo<Root.State>(
    () => ({ disabled, dragging, max, min, value: displayedValue }),
    [disabled, dragging, displayedValue, max, min]
  );

  const percent = toPercent(displayedValue, min, max);
  const anchorPercent = anchor === undefined ? 0 : toPercent(anchor, min, max);

  const context = React.useMemo<KnobContextValue>(
    () => ({
      actions: { change, commit, setDragging },
      meta: {
        anchorPercent,
        angle: START_ANGLE + percent * SWEEP_ANGLE,
        dragMode,
        form,
        formatter,
        inputId,
        inputRef,
        labelId,
        largeStep,
        name,
        percent,
        resetValue,
        setLabelId,
        step,
        valueRef,
        wheelRef,
      },
      state,
    }),
    [
      anchorPercent,
      change,
      commit,
      dragMode,
      form,
      formatter,
      inputId,
      labelId,
      largeStep,
      name,
      percent,
      resetValue,
      setDragging,
      state,
      step,
      wheelRef,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: { ...elementProps, ...resolveStyling(className, style, state) },
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });

  return <KnobContext value={context}>{element}</KnobContext>;
}

export namespace Root {
  export type State = {
    disabled: boolean;
    /** Whether a pointer is dragging the knob. */
    dragging: boolean;
    max: number;
    min: number;
    value: number;
  };

  /**
   * How pointer travel turns into value:
   * - `circular`: rotate around the center; the dial's sweep spans `min…max`.
   * - `revolution`: rotate around the center; one full turn spans `min…max`.
   * - `vertical`: drag up/down like a fader.
   */
  export type DragMode = "circular" | "revolution" | "vertical";

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | ExtraChangeEventDetails<"drag", PointerEvent>
    | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
    | ExtraChangeEventDetails<"wheel", WheelEvent>
    | ExtraChangeEventDetails<"reset", PointerEvent>
    | ExtraChangeEventDetails<"input-change", Event>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"drag", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
    | ExtraCommitEventDetails<"wheel", WheelEvent>
    | ExtraCommitEventDetails<"reset", PointerEvent>
    | ExtraCommitEventDetails<"input-change", Event>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Value the indicator arc grows from (e.g. `0` on a -1…1 pan knob). Defaults to `min`. */
    anchor?: number;
    /** Uncontrolled starting value, and the double-tap reset target. Defaults to the midpoint of `min…max`. */
    defaultValue?: number;
    disabled?: boolean;
    /** @default "circular" */
    dragMode?: DragMode;
    /** Identifies the form that owns the knob's input, when rendered outside it. */
    form?: string;
    /** Formats the value for `Knob.Value` and the input's `aria-valuetext`. */
    format?: Intl.NumberFormatOptions;
    /** Step for Page Up/Page Down and Shift + Arrow keys. @default 10 */
    largeStep?: number;
    locale?: Intl.LocalesArgument;
    /** @default 100 */
    max?: number;
    /** @default 0 */
    min?: number;
    /** Identifies the field when a form is submitted. */
    name?: string;
    /** Fires on every change: drag, keyboard, wheel, reset and input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** @default 1 */
    step?: number;
    value?: number;
  }
}

interface DragGesture {
  /** Rotation accumulated since the press, in radians. */
  accumulatedAngle: number;
  lastAngle: number;
  /** Farthest distance from the press point, in px. */
  maxDistance: number;
  pointerId: number;
  rect: DOMRect;
  startValue: number;
  startX: number;
  startY: number;
}

/**
 * The interactive surface: pointer drags (see `dragMode`), mouse-wheel
 * stepping, and double tap to reset. Sets `touch-action: none` so touch drags
 * don't scroll the page. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useKnobContext("Control");
  const gestureRef = React.useRef<DragGesture | null>(null);
  const lastTapAtRef = React.useRef(0);

  const valueFromGesture = (
    gesture: DragGesture,
    event: React.PointerEvent
  ): number => {
    const range = state.max - state.min;
    if (meta.dragMode === "vertical") {
      return (
        gesture.startValue +
        ((gesture.startY - event.clientY) * range) / VERTICAL_DRAG_RANGE_PX
      );
    }
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
      gesture.accumulatedAngle += delta;
    }
    gesture.lastAngle = angle;
    const fullTurn =
      meta.dragMode === "revolution" ? TAU : degToRad(SWEEP_ANGLE);
    return gesture.startValue + (gesture.accumulatedAngle / fullTurn) * range;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const control = event.currentTarget;
    control.setPointerCapture?.(event.pointerId);
    meta.inputRef.current?.focus({ preventScroll: true });
    const rect = control.getBoundingClientRect();
    gestureRef.current = {
      accumulatedAngle: 0,
      lastAngle: pointerAngle(event.clientX, event.clientY, rect),
      maxDistance: 0,
      pointerId: event.pointerId,
      rect,
      startValue: meta.valueRef.current,
      startX: event.clientX,
      startY: event.clientY,
    };
    actions.setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gesture.maxDistance = Math.max(
      gesture.maxDistance,
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY)
    );
    actions.change(
      valueFromGesture(gesture, event),
      createChangeEventDetails("drag", event.nativeEvent)
    );
  };

  const endGesture = (
    event: React.PointerEvent<HTMLDivElement>,
    allowTap: boolean
  ) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    actions.setDragging(false);
    const native = event.nativeEvent;

    if (allowTap && gesture.maxDistance <= TAP_MAX_MOVE_PX) {
      const now = performance.now();
      const isDoubleTap = now - lastTapAtRef.current <= DOUBLE_TAP_MAX_MS;
      lastTapAtRef.current = isDoubleTap ? 0 : now;
      if (
        isDoubleTap &&
        actions.change(
          meta.resetValue,
          createChangeEventDetails("reset", native)
        )
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "reset",
        });
      }
      return;
    }
    lastTapAtRef.current = 0;
    if (meta.valueRef.current !== gesture.startValue) {
      actions.commit(meta.valueRef.current, { event: native, reason: "drag" });
    }
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onPointerCancel: (event) => endGesture(event, false),
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: (event) => endGesture(event, true),
        style: { touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, meta.wheelRef] : meta.wheelRef,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Control {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}

function useArcProps(
  strokeWidth: number,
  from: number,
  to: number
): React.SVGProps<SVGSVGElement> {
  const hasArc = Math.abs(to - from) > 0.001;
  return {
    "aria-hidden": true,
    children: hasArc ? (
      <path
        d={arcPath(ARC_OUTER_RADIUS - strokeWidth / 2, from, to)}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    ) : null,
    viewBox: "0 0 48 48",
  };
}

/** The full sweep of the dial, as an SVG arc. Renders an `<svg>` element. */
export function Track(componentProps: Track.Props) {
  const {
    className,
    ref,
    render,
    strokeWidth = DEFAULT_ARC_STROKE_WIDTH,
    style,
    ...elementProps
  } = componentProps;
  const { state } = useKnobContext("Track");
  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(useArcProps(strokeWidth, 0, 1), {
      ...elementProps,
      ...resolveStyling(className, style, state),
    }),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Track {
  export type State = Root.State;
  export interface Props extends Omit<PartProps<"svg", State>, "strokeWidth"> {
    /** Stroke width in the 48×48 viewBox; the arc stays inside the box. @default 3 */
    strokeWidth?: number;
  }
}

/**
 * The arc from `anchor` to the value, drawn over the `Track`.
 * Renders an `<svg>` element.
 */
export function Indicator(componentProps: Indicator.Props) {
  const {
    className,
    ref,
    render,
    strokeWidth = DEFAULT_ARC_STROKE_WIDTH,
    style,
    ...elementProps
  } = componentProps;
  const { meta, state } = useKnobContext("Indicator");
  const from = Math.min(meta.anchorPercent, meta.percent);
  const to = Math.max(meta.anchorPercent, meta.percent);
  return useRender({
    defaultTagName: "svg",
    props: mergeProps<"svg">(useArcProps(strokeWidth, from, to), {
      ...elementProps,
      ...resolveStyling(className, style, state),
    }),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Indicator {
  export type State = Root.State;
  export type Props = Track.Props;
}

/**
 * Rotates with the value (`rotate`, clockwise from 12 o'clock), so a pointer
 * drawn inside it points at the value. Holds the knob's native
 * `<input type="range">`, which takes focus, carries the accessible name
 * (`aria-label` / `aria-labelledby`) and the form value, and handles the
 * keyboard. Renders a `<div>` element.
 */
export function Thumb(componentProps: Thumb.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaValueText,
    inputRef: inputRefProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useKnobContext("Thumb");
  const { inputRef } = meta;

  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof inputRefProp === "function") {
        inputRefProp(node);
      } else if (inputRefProp) {
        inputRefProp.current = node;
      }
    },
    [inputRef, inputRefProp]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (state.disabled) {
        return;
      }
      const { current } = meta.valueRef;
      const arrowStep = event.shiftKey ? meta.largeStep : meta.step;
      const targets: Record<string, number> = {
        ArrowDown: current - arrowStep,
        ArrowLeft: current - arrowStep,
        ArrowRight: current + arrowStep,
        ArrowUp: current + arrowStep,
        End: state.max,
        Home: state.min,
        PageDown: current - meta.largeStep,
        PageUp: current + meta.largeStep,
      };
      const next = targets[event.key];
      if (next === undefined) {
        return;
      }
      event.preventDefault();
      const native = event.nativeEvent;
      if (actions.change(next, createChangeEventDetails("keyboard", native))) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "keyboard",
        });
      }
    },
    [actions, meta, state.disabled, state.max, state.min]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const native = event.nativeEvent;
      if (
        actions.change(
          Number(event.currentTarget.value),
          createChangeEventDetails("input-change", native)
        )
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, meta]
  );

  const formattedValue = meta.formatter.format(state.value);

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={
                ariaLabelledBy ?? (ariaLabel ? undefined : meta.labelId)
              }
              aria-valuetext={
                getAriaValueText
                  ? getAriaValueText(formattedValue, state.value)
                  : formattedValue
              }
              disabled={state.disabled}
              form={meta.form}
              id={meta.inputId}
              max={state.max}
              min={state.min}
              name={meta.name}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              ref={setInputRef}
              step={meta.step}
              style={VISUALLY_HIDDEN}
              type="range"
              value={state.value}
            />
          </>
        ),
        style: { rotate: `${meta.angle}deg` },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Thumb {
  export type State = Root.State;
  export interface Props extends PartProps<"div", State> {
    /** Returns the input's `aria-valuetext`, e.g. `"-6 dB"`. Defaults to the formatted value. */
    getAriaValueText?: (formattedValue: string, value: number) => string;
    inputRef?: React.Ref<HTMLInputElement>;
  }
}

/** The formatted value (`format`/`locale` on Root). Renders an `<output>` element. */
export function Value(componentProps: Value.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state } = useKnobContext("Value");
  const formattedValue = meta.formatter.format(state.value);
  return useRender({
    defaultTagName: "output",
    props: mergeProps<"output">(
      {
        "aria-live": "off",
        children:
          typeof children === "function"
            ? children(formattedValue, state.value)
            : (children ?? formattedValue),
        htmlFor: meta.inputId,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Value {
  export type State = Root.State;
  export interface Props extends Omit<PartProps<"output", State>, "children"> {
    children?:
      | React.ReactNode
      | ((formattedValue: string, value: number) => React.ReactNode);
  }
}

/** Accessible label, associated with the thumb's input. Renders a `<div>` element. */
export function Label(componentProps: Label.Props) {
  const {
    className,
    id: idProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { meta, state } = useKnobContext("Label");
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const { setLabelId } = meta;
  React.useEffect(() => {
    setLabelId(id);
    return () => setLabelId(undefined);
  }, [id, setLabelId]);
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { id },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });
}

export namespace Label {
  export type State = Root.State;
  export type Props = PartProps<"div", State>;
}
