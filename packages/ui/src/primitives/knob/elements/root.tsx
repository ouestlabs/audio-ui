import {
  clamp,
  clampFinite,
  createChangeEventDetails,
  type ChangeEventDetails as ExtraChangeEventDetails,
  type CommitEventDetails as ExtraCommitEventDetails,
  type ParameterScaleProp,
  type Point,
  resolveScale,
  roundToStep,
} from "@audio-ui/core";
import {
  START_ANGLE,
  STATE_ATTRIBUTES_MAPPING,
  SWEEP_ANGLE,
  steppedValue,
  WHEEL_DELTA_EPSILON,
} from "@audio-ui/core/knob";
import * as React from "react";
import { useWheel } from "../../../hooks/interactions/use-wheel";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useRender } from "../../internal/render";
import { useLocale } from "../../internal/use-locale";
import { KnobContext, type KnobContextValue } from "../context";

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
    scale: scaleProp = "linear",
    step = 1,
    style,
    value: valueProp,
    ...elementProps
  } = componentProps;
  const scale = resolveScale(scaleProp);

  const resetValue =
    defaultValue ?? roundToStep(scale.toValue(0.5, min, max), step, min);
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(resetValue);
  const value = clampFinite(
    isControlled ? valueProp : uncontrolledValue,
    min,
    max
  );

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
      const next = steppedValue(valueRef.current, delta.y < 0 ? 1 : -1, false, {
        largeStep,
        max,
        min,
        scale,
        step,
      });
      if (change(next, createChangeEventDetails("wheel", event))) {
        commit(valueRef.current, { event, reason: "wheel" });
      }
    },
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const [labelId, setLabelId] = React.useState<string>();
  const resolvedLocale = useLocale(locale);
  const formatter = React.useMemo(
    () => new Intl.NumberFormat(resolvedLocale, format),
    [format, resolvedLocale]
  );

  const state = React.useMemo<Root.State>(
    () => ({ disabled, dragging, max, min, value: displayedValue }),
    [disabled, dragging, displayedValue, max, min]
  );

  const percent = scale.toPosition(displayedValue, min, max);
  const anchorPercent =
    anchor === undefined ? 0 : scale.toPosition(anchor, min, max);

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
        scale,
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
      scale,
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
    | ExtraChangeEventDetails<"reset", KeyboardEvent | PointerEvent>
    | ExtraChangeEventDetails<"input-change", Event>;
  export type CommitEventReason = CommitEventDetails["reason"];
  export type CommitEventDetails =
    | ExtraCommitEventDetails<"drag", PointerEvent>
    | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
    | ExtraCommitEventDetails<"wheel", WheelEvent>
    | ExtraCommitEventDetails<"reset", KeyboardEvent | PointerEvent>
    | ExtraCommitEventDetails<"input-change", Event>;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Value the indicator arc grows from (e.g. `0` on a -1…1 pan knob). Defaults to `min`. */
    anchor?: number;
    /** Uncontrolled starting value, and the reset target of a double tap, an Alt + click and the Delete key. Defaults to the middle of the dial's travel. */
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
    /**
     * How the value maps onto the dial's travel: `linear`, `log` for
     * frequency, Q or ratios (needs a positive `min`), or your own
     * `{ toPosition, toValue }`. Away from linear, the keys and the wheel move
     * a share of the travel (1%, or 10% with Shift and Page keys) rather
     * than a `step`.
     * @default "linear"
     */
    scale?: Scale;
    /** @default 1 */
    step?: number;
    value?: number;
  }

  /** Maps a value onto the dial's travel, 0…1, and back. */
  export type Scale = ParameterScaleProp;
}
