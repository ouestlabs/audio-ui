import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { useWheel } from "../../../hooks/interactions/use-wheel";
import { clamp, clampFinite, type Point, roundToStep } from "../../../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "../../internal/event-details";
import { createPairFormatter } from "../../internal/format-pair";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useLocale } from "../../internal/use-locale";
import { XYPadContext, type XYPadContextValue } from "../context";
import { STATE_ATTRIBUTES_MAPPING, toPercent } from "../internal/shared";

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
    name,
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
  const resetValue = React.useMemo<Point>(
    () =>
      defaultValue ?? {
        x: minX + (maxX - minX) / 2,
        y: minY + (maxY - minY) / 2,
      },
    [defaultValue, maxX, maxY, minX, minY]
  );
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState<Point>(resetValue);
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
  const resolvedLocale = useLocale(locale);
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(resolvedLocale, format),
    [format, resolvedLocale]
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
        name,
        percentX,
        percentY,
        resetValue,
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
      name,
      percentX,
      percentY,
      resetValue,
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
    | ExtraChangeEventDetails<
        "reset",
        KeyboardEvent | MouseEvent | PointerEvent
      >
    | ExtraChangeEventDetails<"input-change", Event>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"press", PointerEvent>
    | ExtraCommitEventDetails<"drag", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
    | ExtraCommitEventDetails<"wheel", WheelEvent>
    | ExtraCommitEventDetails<
        "reset",
        KeyboardEvent | MouseEvent | PointerEvent
      >
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
    /** Names the pad for a form: its two inputs submit as `name.x` and `name.y`. */
    name?: string;
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
