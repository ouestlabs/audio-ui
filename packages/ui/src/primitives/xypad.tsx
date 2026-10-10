import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { useWheel } from "../hooks/interactions/use-wheel";
import {
  clamp,
  clampFinite,
  type Nullable,
  type Point,
  roundToStep,
} from "../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "./internal/event-details";
import { createPairFormatter } from "./internal/format-pair";
import { type PartProps, resolveStyling } from "./internal/part";
import { VISUALLY_HIDDEN } from "./internal/visually-hidden";

/** Shift + arrows and Page Up/Down move this many steps at once. */
const LARGE_STEP_MULTIPLIER = 10;

/** Only `disabled` and `dragging` become data attributes; the numbers stay in `state`. */
const STATE_ATTRIBUTES_MAPPING = {
  maxX: () => null,
  maxY: () => null,
  minX: () => null,
  minY: () => null,
  value: () => null,
};

type Axis = "x" | "y";

function toPercent(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min || 1), 0, 1);
}

interface XYPadContextValue {
  actions: {
    /** Snap, clamp and propose a value; returns whether it was applied. */
    change: (next: Point, eventDetails: Root.ChangeEventDetails) => boolean;
    commit: (value: Point, eventDetails: Root.CommitEventDetails) => void;
    setDragging: (dragging: boolean) => void;
  };
  meta: {
    /** Formats both axes as one string, for `Value`. */
    formatPair: (x: number, y: number) => string;
    formatter: Intl.NumberFormat;
    inputRef: React.RefObject<HTMLInputElement | null>;
    labelId: string | undefined;
    /** Value position, 0…1 from the left. */
    percentX: number;
    /** Value position, 0…1 from the bottom. */
    percentY: number;
    setLabelId: (id: string | undefined) => void;
    stepX: number;
    stepY: number;
    /** Latest displayed value, readable from event handlers. */
    valueRef: React.RefObject<Point>;
    wheelRef: (node: Nullable<HTMLElement>) => void;
  };
  state: Root.State;
}

const XYPadContext = React.createContext<XYPadContextValue | null>(null);

function useXYPadContext(part: string): XYPadContextValue {
  const context = React.use(XYPadContext);
  if (!context) {
    throw new Error(`XYPad.${part} must be used within XYPad.Root`);
  }
  return context;
}

/**
 * Groups all parts of the pad and owns its two-dimensional value. Exposes the
 * value position as CSS variables for crosshairs and guides:
 * `--xy-pad-x` (from the left) and `--xy-pad-y` (from the top), as percentages.
 * Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    defaultValue,
    disabled = false,
    format,
    locale,
    maxX = 100,
    maxY = 100,
    minX = 0,
    minY = 0,
    onValueChange,
    onValueCommitted,
    ref,
    render,
    stepX = 1,
    stepY = 1,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;

  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<Point>(
    () =>
      defaultValue ?? {
        x: minX + (maxX - minX) / 2,
        y: minY + (maxY - minY) / 2,
      }
  );
  const rawValue = isControlled ? valueProp : uncontrolledValue;
  const value = React.useMemo(
    () => ({
      x: clampFinite(rawValue.x, minX, maxX),
      y: clampFinite(rawValue.y, minY, maxY),
    }),
    [maxX, maxY, minX, minY, rawValue.x, rawValue.y]
  );

  // While dragging, the pad follows the pointer even if a controlled value
  // lags behind; on release the controlled value rules again.
  const [dragging, setDraggingState] = React.useState(false);
  const [dragValue, setDragValue] = React.useState<Point | null>(null);
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
    (raw: Point, eventDetails: Root.ChangeEventDetails) => {
      const next = {
        x: clamp(roundToStep(raw.x, stepX, minX), minX, maxX),
        y: clamp(roundToStep(raw.y, stepY, minY), minY, maxY),
      };
      const { current } = valueRef;
      if (next.x === current.x && next.y === current.y) {
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
    [isControlled, maxX, maxY, minX, minY, onValueChange, stepX, stepY]
  );

  const commit = React.useCallback(
    (committed: Point, eventDetails: Root.CommitEventDetails) => {
      onValueCommitted?.(committed, eventDetails);
    },
    [onValueCommitted]
  );

  // Trackpads scroll in two dimensions: the wheel moves the point by the same
  // distance a drag would.
  const { wheelRef } = useWheel({
    disabled,
    onWheel: (event: WheelEvent, delta: Point) => {
      const element = event.currentTarget;
      if (!(element instanceof Element)) {
        return;
      }
      const rect = element.getBoundingClientRect();
      const { current } = valueRef;
      const next = {
        x: current.x + (delta.x * (maxX - minX)) / Math.max(rect.width, 1),
        y: current.y - (delta.y * (maxY - minY)) / Math.max(rect.height, 1),
      };
      if (change(next, createChangeEventDetails("wheel", event))) {
        commit(valueRef.current, { event, reason: "wheel" });
      }
    },
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [labelId, setLabelId] = React.useState<string>();
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(locale, format),
    [format, locale]
  );
  const formatPair = React.useMemo(
    () => createPairFormatter(formatter),
    [formatter]
  );

  const state = React.useMemo<Root.State>(
    () => ({
      disabled,
      dragging,
      maxX,
      maxY,
      minX,
      minY,
      value: displayedValue,
    }),
    [disabled, dragging, displayedValue, maxX, maxY, minX, minY]
  );

  const percentX = toPercent(displayedValue.x, minX, maxX);
  const percentY = toPercent(displayedValue.y, minY, maxY);

  const context = React.useMemo<XYPadContextValue>(
    () => ({
      actions: { change, commit, setDragging },
      meta: {
        formatPair,
        formatter,
        inputRef,
        labelId,
        percentX,
        percentY,
        setLabelId,
        stepX,
        stepY,
        valueRef,
        wheelRef,
      },
      state,
    }),
    [
      change,
      commit,
      formatPair,
      formatter,
      labelId,
      percentX,
      percentY,
      setDragging,
      state,
      stepX,
      stepY,
      wheelRef,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          "--xy-pad-x": `${percentX * 100}%`,
          "--xy-pad-y": `${100 - percentY * 100}%`,
        } as React.CSSProperties,
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
    stateAttributesMapping: STATE_ATTRIBUTES_MAPPING,
  });

  return <XYPadContext value={context}>{element}</XYPadContext>;
}

export namespace Root {
  export type State = {
    disabled: boolean;
    /** Whether a pointer is dragging on the pad. */
    dragging: boolean;
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
    value: Point;
  };

  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type ChangeEventDetails =
    | ExtraChangeEventDetails<"press", PointerEvent>
    | ExtraChangeEventDetails<"drag", PointerEvent>
    | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
    | ExtraChangeEventDetails<"wheel", WheelEvent>
    | ExtraChangeEventDetails<"input-change", Event>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"press", PointerEvent>
    | ExtraCommitEventDetails<"drag", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
    | ExtraCommitEventDetails<"wheel", WheelEvent>
    | ExtraCommitEventDetails<"input-change", Event>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting value. Defaults to the center of the pad. */
    defaultValue?: Point;
    disabled?: boolean;
    /** Formats each axis for `XYPad.Value` and the inputs' `aria-valuetext`. */
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
    /** Fires on every change: press, drag, keyboard, wheel and input changes. */
    onValueChange?: (value: Point, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (value: Point, eventDetails: CommitEventDetails) => void;
    /** @default 1 */
    stepX?: number;
    /** @default 1 */
    stepY?: number;
    value?: Point;
  }
}

interface DragGesture {
  /** Whether the gesture changed the value at least once; if so its end commits, even back on the start value. */
  changed: boolean;
  /** Whether the pointer moved after the press: the commit reason is "drag", else "press". */
  moved: boolean;
  pointerId: number;
  rect: DOMRect;
}

/**
 * The pad surface: a press jumps the value to the pointer and a drag follows
 * it; the mouse wheel / trackpad moves it too. Sets `touch-action: none` so
 * touch drags don't scroll the page. Renders a `<div>` element.
 */
export function Control(componentProps: Control.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useXYPadContext("Control");
  const gestureRef = React.useRef<DragGesture | null>(null);

  const valueAt = (gesture: DragGesture, event: React.PointerEvent): Point => {
    const { rect } = gesture;
    const fromLeft = clamp(
      (event.clientX - rect.left) / Math.max(rect.width, 1),
      0,
      1
    );
    const fromBottom = clamp(
      (rect.bottom - event.clientY) / Math.max(rect.height, 1),
      0,
      1
    );
    return {
      x: state.minX + fromLeft * (state.maxX - state.minX),
      y: state.minY + fromBottom * (state.maxY - state.minY),
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const control = event.currentTarget;
    control.setPointerCapture?.(event.pointerId);
    meta.inputRef.current?.focus({ preventScroll: true });
    const gesture: DragGesture = {
      changed: false,
      moved: false,
      pointerId: event.pointerId,
      rect: control.getBoundingClientRect(),
    };
    gestureRef.current = gesture;
    actions.setDragging(true);
    gesture.changed = actions.change(
      valueAt(gesture, event),
      createChangeEventDetails("press", event.nativeEvent)
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gesture.moved = true;
    if (
      actions.change(
        valueAt(gesture, event),
        createChangeEventDetails("drag", event.nativeEvent)
      )
    ) {
      gesture.changed = true;
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    actions.setDragging(false);
    if (gesture.changed) {
      actions.commit(meta.valueRef.current, {
        event: event.nativeEvent,
        reason: gesture.moved ? "drag" : "press",
      });
    }
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onPointerCancel: handlePointerEnd,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
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

/**
 * Marks the value on the pad (`left`/`top` as percentages, centered with
 * `translate`). Holds two native `<input type="range">`s, one per axis: the X
 * input takes focus, both carry the accessible name, and the arrow keys move
 * both axes. Renders a `<div>` element.
 */
export function Thumb(componentProps: Thumb.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    getAriaLabel,
    getAriaValueText,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { actions, meta, state } = useXYPadContext("Thumb");

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (state.disabled) {
        return;
      }
      const { current } = meta.valueRef;
      const multiplier = event.shiftKey ? LARGE_STEP_MULTIPLIER : 1;
      const dx = meta.stepX * multiplier;
      const dy = meta.stepY * multiplier;
      const largeDy = meta.stepY * LARGE_STEP_MULTIPLIER;
      const targets: Record<string, Point> = {
        ArrowDown: { x: current.x, y: current.y - dy },
        ArrowLeft: { x: current.x - dx, y: current.y },
        ArrowRight: { x: current.x + dx, y: current.y },
        ArrowUp: { x: current.x, y: current.y + dy },
        End: { x: state.maxX, y: current.y },
        Home: { x: state.minX, y: current.y },
        PageDown: { x: current.x, y: current.y - largeDy },
        PageUp: { x: current.x, y: current.y + largeDy },
      };
      const next = targets[event.key];
      if (!next) {
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
    [actions, meta, state.disabled, state.maxX, state.minX]
  );

  const handleChange = React.useCallback(
    (axis: Axis, event: React.ChangeEvent<HTMLInputElement>) => {
      const native = event.nativeEvent;
      const next = {
        ...meta.valueRef.current,
        [axis]: Number(event.currentTarget.value),
      };
      if (
        actions.change(next, createChangeEventDetails("input-change", native))
      ) {
        actions.commit(meta.valueRef.current, {
          event: native,
          reason: "input-change",
        });
      }
    },
    [actions, meta]
  );
  const handleChangeX = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => handleChange("x", event),
    [handleChange]
  );
  const handleChangeY = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => handleChange("y", event),
    [handleChange]
  );

  const inputProps = (axis: Axis) => {
    const value = state.value[axis];
    const formattedValue = meta.formatter.format(value);
    let label = getAriaLabel?.(axis);
    if (label === undefined && ariaLabel) {
      label = `${ariaLabel} ${axis.toUpperCase()}`;
    }
    return {
      "aria-describedby": ariaDescribedBy,
      "aria-label": label,
      "aria-labelledby":
        ariaLabelledBy ?? (label === undefined ? meta.labelId : undefined),
      "aria-orientation":
        axis === "x" ? ("horizontal" as const) : ("vertical" as const),
      "aria-valuetext": getAriaValueText
        ? getAriaValueText(formattedValue, value, axis)
        : formattedValue,
      disabled: state.disabled,
      max: axis === "x" ? state.maxX : state.maxY,
      min: axis === "x" ? state.minX : state.minY,
      onKeyDown: handleKeyDown,
      step: axis === "x" ? meta.stepX : meta.stepY,
      style: VISUALLY_HIDDEN,
      type: "range",
      value,
    };
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        children: (
          <>
            {children}
            <input
              {...inputProps("x")}
              onChange={handleChangeX}
              ref={meta.inputRef}
            />
            <input
              {...inputProps("y")}
              onChange={handleChangeY}
              tabIndex={-1}
            />
          </>
        ),
        style: {
          left: `${meta.percentX * 100}%`,
          top: `${100 - meta.percentY * 100}%`,
          translate: "-50% -50%",
        },
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
    /** Names each axis input. Defaults to `aria-label` followed by "X" / "Y". */
    getAriaLabel?: (axis: Axis) => string;
    /** Returns an axis input's `aria-valuetext`. Defaults to the formatted value. */
    getAriaValueText?: (
      formattedValue: string,
      value: number,
      axis: Axis
    ) => string;
  }
}

/**
 * The formatted value (`format`/`locale` on Root), `"x, y"` by default.
 * Renders an `<output>` element.
 */
export function Value(componentProps: Value.Props) {
  const { children, className, ref, render, style, ...elementProps } =
    componentProps;
  const { meta, state } = useXYPadContext("Value");
  const formattedX = meta.formatter.format(state.value.x);
  const formattedY = meta.formatter.format(state.value.y);
  return useRender({
    defaultTagName: "output",
    props: mergeProps<"output">(
      {
        "aria-live": "off",
        children:
          typeof children === "function"
            ? children(formattedX, formattedY, state.value)
            : (children ?? meta.formatPair(state.value.x, state.value.y)),
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
      | ((
          formattedX: string,
          formattedY: string,
          value: Point
        ) => React.ReactNode);
  }
}

/** Accessible label, associated with both axis inputs. Renders a `<div>` element. */
export function Label(componentProps: Label.Props) {
  const {
    className,
    id: idProp,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { meta, state } = useXYPadContext("Label");
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
