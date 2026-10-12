import {
  clamp,
  clampFinite,
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
  type Point,
  roundToStep,
} from "@audio-ui/core";
import * as React from "react";
import { useWheel } from "../../../hooks/interactions/use-wheel";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useLocale } from "../../internal/use-locale";
import {
  FADER_STATE_ATTRIBUTES,
  FaderContext,
  type FaderContextValue,
} from "../context";
import {
  DEFAULT_MAX,
  DEFAULT_MIN,
  WHEEL_DELTA_EPSILON,
} from "../internal/shared";

/** One thumb: the index a change is reported for. */
export function faderChangeDetails<Reason extends Root.ChangeEventReason>(
  reason: Reason,
  event: Event
) {
  return Object.assign(createChangeEventDetails(reason, event), {
    activeThumbIndex: 0,
  }) as Root.ChangeEventDetails;
}

/**
 * Groups all parts of the fader, with audio defaults (vertical, -60…+6) and
 * mouse-wheel stepping. While a pointer drags it, the
 * thumb follows the pointer even if a controlled `value` lags behind (a seek
 * bar driven by playback time, automation), reject a value with
 * `eventDetails.cancel()` instead. Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    anchor,
    className,
    defaultValue,
    disabled = false,
    format,
    largeStep = 10,
    locale,
    max = DEFAULT_MAX,
    min = DEFAULT_MIN,
    name,
    onValueChange,
    onValueCommitted,
    orientation = "vertical",
    ref,
    render,
    step = 1,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;
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
  const valueRef = React.useRef(displayedValue);
  valueRef.current = displayedValue;

  const change = React.useCallback(
    (next: number, details: Root.ChangeEventDetails) => {
      onValueChange?.(next, details);
      if (details.isCanceled) {
        return false;
      }
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      if (
        isControlled &&
        (details.reason === "drag" || details.reason === "track-press")
      ) {
        setDragValue(next);
      }
      return true;
    },
    [isControlled, onValueChange]
  );

  const commit = React.useCallback(
    (next: number, details: Root.CommitEventDetails) => {
      setDragValue(null);
      onValueCommitted?.(next, details);
    },
    [onValueCommitted]
  );

  /** A change that is over as soon as it is made: reset, typed, wheel, keys. */
  const setAtOnce = React.useCallback(
    (
      next: number,
      reason: Exclude<Root.ChangeEventReason, "drag" | "track-press">,
      event: Event
    ) => {
      if (next === valueRef.current) {
        return;
      }
      if (change(next, faderChangeDetails(reason, event))) {
        commit(next, { event, reason } as Root.CommitEventDetails);
      }
    },
    [change, commit]
  );

  const reset = React.useCallback(
    (event: KeyboardEvent | MouseEvent | PointerEvent) =>
      setAtOnce(clamp(resetValue, min, max), "reset", event),
    [max, min, resetValue, setAtOnce]
  );

  const type = React.useCallback(
    (typed: number, event: Event) =>
      setAtOnce(
        clamp(roundToStep(typed, step, min), min, max),
        "input-change",
        event
      ),
    [max, min, setAtOnce, step]
  );

  const { wheelRef } = useWheel({
    disabled,
    onWheel: (event: WheelEvent, delta: Point) => {
      if (Math.abs(delta.y) < WHEEL_DELTA_EPSILON) {
        return;
      }
      const next = clamp(
        roundToStep(valueRef.current + (delta.y < 0 ? step : -step), step, min),
        min,
        max
      );
      setAtOnce(next, "wheel", event);
    },
  });

  const resolvedLocale = useLocale(locale);
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(resolvedLocale, format),
    [format, resolvedLocale]
  );
  const [dragging, setDragging] = React.useState(false);
  const [labelId, setLabelId] = React.useState<string | undefined>();
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const thumbRef = React.useRef<HTMLElement | null>(null);

  const state = React.useMemo<Root.State>(
    () => ({ disabled, dragging, orientation, value: displayedValue }),
    [disabled, displayedValue, dragging, orientation]
  );

  const contextValue = React.useMemo<FaderContextValue>(
    () => ({
      anchor,
      change,
      commit,
      disabled,
      formatted: formatter.format(displayedValue),
      inputId,
      inputRef,
      labelId,
      largeStep,
      max,
      min,
      name,
      orientation,
      reset,
      set: setAtOnce,
      setDragging,
      setLabelId,
      state,
      step,
      thumbRef,
      type,
      value: displayedValue,
      wheelRef,
    }),
    [
      anchor,
      change,
      commit,
      disabled,
      displayedValue,
      formatter,
      inputId,
      labelId,
      largeStep,
      max,
      min,
      name,
      orientation,
      reset,
      setAtOnce,
      state,
      step,
      type,
      wheelRef,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { "aria-labelledby": labelId, role: "group" },
      elementProps,
      resolveStyling(className, style, state)
    ),
    ref,
    render,
    state,
    stateAttributesMapping: FADER_STATE_ATTRIBUTES,
  });

  return <FaderContext value={contextValue}>{element}</FaderContext>;
}

type Details<Reason extends string, E extends Event> = ExtraChangeEventDetails<
  Reason,
  E
> & {
  /** Always `0`: a fader has one thumb. */
  activeThumbIndex: number;
};

export namespace Root {
  export interface State {
    disabled: boolean;
    /** Whether a pointer is moving the thumb. */
    dragging: boolean;
    orientation: "horizontal" | "vertical";
    /** The value as displayed. */
    value: number;
  }
  export type ChangeEventDetails =
    | Details<"drag" | "track-press", PointerEvent>
    | Details<"keyboard", KeyboardEvent>
    | Details<"input-change", Event>
    | Details<"wheel", WheelEvent>
    | Details<"reset", KeyboardEvent | MouseEvent | PointerEvent>;
  export type ChangeEventReason = ChangeEventDetails["reason"];
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"drag" | "track-press", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
    | ExtraCommitEventDetails<"input-change", Event>
    | ExtraCommitEventDetails<"wheel", WheelEvent>
    | ExtraCommitEventDetails<
        "reset",
        KeyboardEvent | MouseEvent | PointerEvent
      >;
  export type CommitEventReason = CommitEventDetails["reason"];

  export interface Props
    extends Omit<PartProps<"div", State>, "defaultValue" | "onChange"> {
    /** Value the `Indicator` fills from, such as `0` on a -1…1 pan. Defaults to `min`. */
    anchor?: number;
    /** Uncontrolled starting value, and what a double click, an Alt + click or the Delete key return to; defaults to the midpoint of `min…max`. */
    defaultValue?: number;
    /** @default false */
    disabled?: boolean;
    /** How the value is written for `Value` and announced, e.g. `{ maximumFractionDigits: 1 }`. */
    format?: Intl.NumberFormatOptions;
    /** Step for Page Up/Page Down and Shift + arrow keys. @default 10 */
    largeStep?: number;
    /** Locale of the formatted value. Defaults to the browser's language. */
    locale?: Intl.LocalesArgument;
    /** @default 6 */
    max?: number;
    /** @default -60 */
    min?: number;
    /** Name of the native input, for a form. */
    name?: string;
    /** Fires on drag, track press, keyboard, wheel and form input changes. */
    onValueChange?: (value: number, eventDetails: ChangeEventDetails) => void;
    /** Fires when an interaction ends with a new value. */
    onValueCommitted?: (
      value: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** @default "vertical" */
    orientation?: "horizontal" | "vertical";
    /** Granularity of every change. @default 1 */
    step?: number;
    value?: number;
  }
}
