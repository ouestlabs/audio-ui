import { Slider } from "@base-ui/react/slider";
import * as React from "react";
import { useWheel } from "../../../hooks/interactions/use-wheel";
import { clamp, clampFinite, type Point, roundToStep } from "../../../utils";
import {
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
} from "../../internal/event-details";
import { FaderContext, type FaderContextValue } from "../context";
import {
  DEFAULT_MAX,
  DEFAULT_MIN,
  WHEEL_DELTA_EPSILON,
} from "../internal/shared";

/**
 * Groups all parts of the fader, with audio defaults (vertical, -60…+6) and
 * mouse-wheel stepping. While a pointer drags it, the
 * thumb follows the pointer even if a controlled `value` lags behind (a seek
 * bar driven by playback time, automation), reject a value with
 * `eventDetails.cancel()` instead. Renders a `<div>` element.
 */
export function Root({
  anchor,
  defaultValue,
  disabled = false,
  max = DEFAULT_MAX,
  min = DEFAULT_MIN,
  onValueChange,
  onValueCommitted,
  orientation = "vertical",
  step = 1,
  value: valueProp,
  ...props
}: Root.Props) {
  const isControlled = valueProp !== undefined;
  const resetValue = defaultValue ?? min + (max - min) / 2;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(resetValue);
  const value = clampFinite(
    isControlled ? valueProp : uncontrolledValue,
    min,
    max
  );

  // Holds the dragged value until the pointer is released, so a controlled
  // value that lags behind can't pull the thumb back mid-drag.
  const [dragValue, setDragValue] = React.useState<number | null>(null);
  const isFrozen = dragValue !== null;
  React.useEffect(() => {
    if (!isFrozen) {
      return;
    }
    const release = () => setDragValue(null);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [isFrozen]);
  const displayedValue = dragValue ?? value;

  const handleValueChange = React.useCallback(
    (next: number, eventDetails: Root.ChangeEventDetails) => {
      onValueChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (
        isControlled &&
        (eventDetails.reason === "drag" ||
          eventDetails.reason === "track-press")
      ) {
        setDragValue(next);
      }
    },
    [isControlled, onValueChange]
  );

  const handleValueCommitted = React.useCallback(
    (next: number, eventDetails: Root.CommitEventDetails) => {
      setDragValue(null);
      onValueCommitted?.(next, eventDetails);
    },
    [onValueCommitted]
  );

  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;

  const reset = React.useCallback(
    (event: KeyboardEvent | MouseEvent | PointerEvent) => {
      const next = clamp(resetValue, min, max);
      if (next === valueRef.current) {
        return;
      }
      const details = Object.assign(createChangeEventDetails("reset", event), {
        activeThumbIndex: 0,
      });
      onValueChange?.(next, details);
      if (details.isCanceled) {
        return;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueCommitted?.(next, { event, reason: "reset" });
    },
    [isControlled, max, min, onValueChange, onValueCommitted, resetValue]
  );

  const type = React.useCallback(
    (typed: number, event: Event) => {
      const next = clamp(roundToStep(typed, step, min), min, max);
      if (next === valueRef.current) {
        return;
      }
      const details = Object.assign(
        createChangeEventDetails("input-change", event),
        { activeThumbIndex: 0 }
      ) as Root.ChangeEventDetails;
      onValueChange?.(next, details);
      if (details.isCanceled) {
        return;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueCommitted?.(next, {
        event,
        reason: "input-change",
      } as Root.CommitEventDetails);
    },
    [isControlled, max, min, onValueChange, onValueCommitted, step]
  );

  const { wheelRef } = useWheel({
    disabled,
    onWheel: (event: WheelEvent, delta: Point) => {
      if (Math.abs(delta.y) < WHEEL_DELTA_EPSILON) {
        return;
      }
      const { current } = valueRef;
      const next = clamp(
        roundToStep(current + (delta.y < 0 ? step : -step), step, min),
        min,
        max
      );
      if (next === current) {
        return;
      }
      const changeDetails = Object.assign(
        createChangeEventDetails("wheel", event),
        { activeThumbIndex: 0 }
      );
      onValueChange?.(next, changeDetails);
      if (changeDetails.isCanceled) {
        return;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueCommitted?.(next, { event, reason: "wheel" });
    },
  });

  const contextValue = React.useMemo<FaderContextValue>(
    () => ({
      anchor,
      disabled,
      max,
      min,
      orientation,
      reset,
      type,
      value: displayedValue,
      wheelRef,
    }),
    [
      anchor,
      disabled,
      displayedValue,
      max,
      min,
      orientation,
      reset,
      type,
      wheelRef,
    ]
  );

  return (
    <FaderContext value={contextValue}>
      <Slider.Root
        {...props}
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={handleValueChange}
        onValueCommitted={handleValueCommitted}
        orientation={orientation}
        step={step}
        value={displayedValue}
      />
    </FaderContext>
  );
}

export namespace Root {
  export type State = Slider.Root.State;
  export type ChangeEventReason =
    | Slider.Root.ChangeEventReason
    | "reset"
    | "wheel";
  export type ChangeEventDetails =
    | Slider.Root.ChangeEventDetails
    | (ExtraChangeEventDetails<"wheel", WheelEvent> & {
        activeThumbIndex: number;
      })
    | (ExtraChangeEventDetails<
        "reset",
        KeyboardEvent | MouseEvent | PointerEvent
      > & { activeThumbIndex: number });
  export type CommitEventReason =
    | Slider.Root.CommitEventReason
    | "reset"
    | "wheel";
  export type CommitEventDetails =
    | Slider.Root.CommitEventDetails
    | ExtraCommitEventDetails<"wheel", WheelEvent>
    | ExtraCommitEventDetails<
        "reset",
        KeyboardEvent | MouseEvent | PointerEvent
      >;

  export interface Props
    extends Omit<
      Slider.Root.Props<number>,
      | "defaultValue"
      | "max"
      | "min"
      | "onValueChange"
      | "onValueCommitted"
      | "orientation"
      | "value"
    > {
    /** Value the `Indicator` fills from, such as `0` on a -1…1 pan. Defaults to `min`. */
    anchor?: number;
    /** Uncontrolled starting value, and what a double click, an Alt + click or the Delete key return to; defaults to the midpoint of `min…max`. */
    defaultValue?: number;
    /** @default 6 */
    max?: number;
    /** @default -60 */
    min?: number;
    /** Fires on drag, track press, keyboard, wheel and form input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** @default "vertical" */
    orientation?: "horizontal" | "vertical";
    value?: number;
  }
}
