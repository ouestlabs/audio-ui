import * as React from "react";
import type { Point } from "../../../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "../../internal/event-details";
import { type PartProps, resolveStyling } from "../../internal/part";
import { isReleased } from "../../internal/pointer";
import { mergeProps, useRender } from "../../internal/render";
import { useLocale } from "../../internal/use-locale";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import { type PlotAxis, positionOn, usePlotContext, valueOn } from "../context";

type Axis = "x" | "y";

/** What an arrow key moves the handle by, as a share of the axis; Shift and Page Up/Down move ten times as far. */
const KEY_STEP = 0.01;
const LARGE_KEY_STEP = 0.1;
/** Shift slows a drag down to this share of the pointer's travel. */
const FINE_DRAG = 0.25;

const DEFAULT_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  maximumFractionDigits: 2,
};

interface DragGesture {
  changed: boolean;
  fine: boolean;
  /** Where the handle was, as positions along each axis, when the drag began or Shift last changed. */
  origin: Point;
  pointerId: number;
  /** The plot's box when the press began: it does not move under a drag. */
  rect: DOMRect | null;
  start: Point;
}

/** `value` kept within both axes. */
function clampPoint(value: Point, x: PlotAxis, y: PlotAxis): Point {
  return {
    x: valueOn(x, positionOn(x, value.x)),
    y: valueOn(y, positionOn(y, value.y)),
  };
}

/**
 * A point on the plot that can be moved: an equalizer band at its frequency
 * and gain, a filter's cutoff and resonance, a compressor's threshold. Its
 * value is in the axes' units, and `axis` can hold it to one of them.
 *
 * Dragging moves it from where it is, never jumping to the pointer, four
 * times finer with Shift. A double click, an Alt + click or the Delete key
 * return it to `defaultValue`, or the middle of the plot. It holds a native `<input type="range">` per axis
 * it moves along, carrying the accessible names: the first takes focus, and
 * the arrow keys move it by a hundredth of the axis, a tenth with Shift.
 * Renders a `<div>` element.
 */
export function Handle(componentProps: Handle.Props) {
  const locale = useLocale();
  const defaultFormat = React.useMemo(
    () => new Intl.NumberFormat(locale, DEFAULT_FORMAT_OPTIONS),
    [locale]
  );
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    axis = "both",
    children,
    className,
    defaultValue,
    disabled: disabledProp = false,
    getAriaLabel,
    getAriaValueText,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;
  const { meta, state: plotState } = usePlotContext("Handle");
  const { x, y } = meta;
  const disabled = disabledProp || plotState.disabled;
  const moves = (along: Axis) => axis === "both" || axis === along;

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<Point>(
    () =>
      defaultValue ?? {
        x: valueOn(x, 0.5),
        y: valueOn(y, 0.5),
      }
  );
  const rawValue = isControlled ? valueProp : uncontrolledValue;

  // A controlled value is the last word, even mid-drag: a consumer that holds
  // the point to a curve or a limit sees the handle held there, not wherever
  // the pointer has gone.
  const [dragging, setDraggingState] = React.useState(false);
  const value = clampPoint(rawValue, x, y);
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const gestureRef = React.useRef<DragGesture | null>(null);

  const setDragging = setDraggingState;

  /** Clamps and proposes a value; returns whether it was applied. */
  const change = (next: Point, eventDetails: Handle.ChangeEventDetails) => {
    const clamped = clampPoint(next, x, y);
    const { current } = valueRef;
    if (clamped.x === current.x && clamped.y === current.y) {
      return false;
    }
    onValueChange?.(clamped, eventDetails);
    if (eventDetails.isCanceled) {
      return false;
    }
    valueRef.current = clamped;
    if (!isControlled) {
      setUncontrolledValue(clamped);
    }
    return true;
  };

  /** Moves the handle to positions along each axis, 0…1, for the axes it moves along. */
  const moveTo = (position: Point, eventDetails: Handle.ChangeEventDetails) => {
    const { current } = valueRef;
    return change(
      {
        x: moves("x") ? valueOn(x, position.x) : current.x,
        y: moves("y") ? valueOn(y, position.y) : current.y,
      },
      eventDetails
    );
  };

  const positionOf = (point: Point): Point => ({
    x: positionOn(x, point.x),
    y: positionOn(y, point.y),
  });

  /** Back to the default value, along the axes the handle moves along. */
  const reset = (event: KeyboardEvent | MouseEvent | PointerEvent) => {
    const target = positionOf(
      clampPoint(
        defaultValue ?? { x: valueOn(x, 0.5), y: valueOn(y, 0.5) },
        x,
        y
      )
    );
    if (moveTo(target, createChangeEventDetails("reset", event))) {
      onValueCommitted?.(valueRef.current, { event, reason: "reset" });
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      reset(event.nativeEvent);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || disabled) {
      return;
    }
    event.preventDefault();
    // An Alt + click returns to the default, as in a DAW.
    if (event.altKey) {
      reset(event.nativeEvent);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    gestureRef.current = {
      changed: false,
      fine: event.shiftKey,
      origin: positionOf(valueRef.current),
      pointerId: event.pointerId,
      rect: meta.measure(true),
      start: { x: event.clientX, y: event.clientY },
    };
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    // Measured when the press began: the plot does not move under a drag.
    const rect = gesture?.rect;
    if (!(gesture && rect) || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      handlePointerEnd(event);
      return;
    }
    // Shift pressed or let go mid-drag: carry on from here at the new speed.
    if (event.shiftKey !== gesture.fine) {
      gesture.fine = event.shiftKey;
      gesture.origin = positionOf(valueRef.current);
      gesture.start = { x: event.clientX, y: event.clientY };
    }
    const speed = gesture.fine ? FINE_DRAG : 1;
    const along = {
      x:
        gesture.origin.x +
        ((event.clientX - gesture.start.x) / Math.max(rect.width, 1)) * speed,
      y:
        gesture.origin.y -
        ((event.clientY - gesture.start.y) / Math.max(rect.height, 1)) * speed,
    };
    if (moveTo(along, createChangeEventDetails("drag", event.nativeEvent))) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    // Read before settling: the value falls back to the known one after.
    const committed = valueRef.current;
    setDragging(false);
    if (gesture.changed) {
      onValueCommitted?.(committed, {
        event: event.nativeEvent,
        reason: "drag",
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      reset(event.nativeEvent);
      return;
    }
    const step = event.shiftKey ? LARGE_KEY_STEP : KEY_STEP;
    const at = positionOf(valueRef.current);
    // Home and End go to the ends of the axis the handle moves along first.
    const ends: Axis = moves("x") ? "x" : "y";
    const targets: Record<string, Point> = {
      ArrowDown: { x: at.x, y: at.y - step },
      ArrowLeft: { x: at.x - step, y: at.y },
      ArrowRight: { x: at.x + step, y: at.y },
      ArrowUp: { x: at.x, y: at.y + step },
      End: { ...at, [ends]: 1 },
      Home: { ...at, [ends]: 0 },
      PageDown: { x: at.x, y: at.y - LARGE_KEY_STEP },
      PageUp: { x: at.x, y: at.y + LARGE_KEY_STEP },
    };
    const target = targets[event.key];
    if (!target) {
      return;
    }
    event.preventDefault();
    const native = event.nativeEvent;
    if (moveTo(target, createChangeEventDetails("keyboard", native))) {
      onValueCommitted?.(valueRef.current, {
        event: native,
        reason: "keyboard",
      });
    }
  };

  const handleChange = (
    along: Axis,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const native = event.nativeEvent;
    const at = positionOf(valueRef.current);
    const position = { ...at, [along]: Number(event.currentTarget.value) };
    if (moveTo(position, createChangeEventDetails("input-change", native))) {
      onValueCommitted?.(valueRef.current, {
        event: native,
        reason: "input-change",
      });
    }
  };

  const at = positionOf(value);
  const handleChangeX = (event: React.ChangeEvent<HTMLInputElement>) =>
    handleChange("x", event);
  const handleChangeY = (event: React.ChangeEvent<HTMLInputElement>) =>
    handleChange("y", event);
  const inputFor = (along: Axis, first: boolean) => {
    let label = getAriaLabel?.(along);
    if (label === undefined && ariaLabel) {
      label =
        axis === "both" ? `${ariaLabel} ${along.toUpperCase()}` : ariaLabel;
    }
    const current = value[along];
    return (
      <input
        aria-describedby={ariaDescribedBy}
        aria-label={label}
        aria-labelledby={label === undefined ? ariaLabelledBy : undefined}
        aria-orientation={along === "x" ? "horizontal" : "vertical"}
        aria-valuetext={
          getAriaValueText?.(current, along) ?? defaultFormat.format(current)
        }
        disabled={disabled}
        key={along}
        max={1}
        min={0}
        onChange={along === "x" ? handleChangeX : handleChangeY}
        // biome-ignore lint/performance/noJsxPropsBind: the handler reads the latest value and callbacks, so it is made each render.
        onKeyDown={handleKeyDown}
        ref={first ? inputRef : undefined}
        step="any"
        style={VISUALLY_HIDDEN}
        tabIndex={first ? undefined : -1}
        type="range"
        value={at[along]}
      />
    );
  };

  const state = React.useMemo<Handle.State>(
    () => ({ axis, disabled, dragging }),
    [axis, disabled, dragging]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            {moves("x") ? inputFor("x", true) : null}
            {moves("y") ? inputFor("y", !moves("x")) : null}
          </>
        ),
        onDoubleClick: handleDoubleClick,
        onLostPointerCapture: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        style: {
          left: `${at.x * 100}%`,
          position: "absolute",
          top: `${(1 - at.y) * 100}%`,
          touchAction: "none",
          translate: "-50% -50%",
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace Handle {
  export type State = {
    /** The axes the handle moves along. */
    axis: "both" | Axis;
    disabled: boolean;
    /** Whether a pointer is dragging the handle. */
    dragging: boolean;
  };
  export type Value = Point;
  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | ExtraChangeEventDetails<"drag", PointerEvent>
    | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
    | ExtraChangeEventDetails<"input-change", Event>
    | ExtraChangeEventDetails<"reset", Event>;
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"drag", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
    | ExtraCommitEventDetails<"input-change", Event>
    | ExtraCommitEventDetails<"reset", Event>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** The axes the handle moves along; the other keeps the value given. @default "both" */
    axis?: "both" | Axis;
    /** Uncontrolled starting value. Defaults to the middle of the plot. */
    defaultValue?: Value;
    disabled?: boolean;
    /** Names each axis input. Defaults to `aria-label`, followed by "X" / "Y" when the handle moves along both. */
    getAriaLabel?: (axis: Axis) => string;
    /** Returns an axis input's `aria-valuetext`, from its value. Defaults to the number. */
    getAriaValueText?: (value: number, axis: Axis) => string;
    /** Fires while the handle is moved: drag, keyboard and input changes. */
    onValueChange?: (value: Value, eventDetails: ChangeEventDetails) => void;
    /** Fires when a gesture that moved the handle ends, and after each key or input change. */
    onValueCommitted?: (value: Value, eventDetails: CommitEventDetails) => void;
    /** The handle's position, in the axes' units. */
    value?: Value;
  }
}
