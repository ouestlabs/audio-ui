import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
  Point,
} from "@audio-ui/core";
import {
  createPlotHandleController,
  type PlotHandleOptions,
} from "@audio-ui/core/plot";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { useLocale } from "../../internal/use-locale.ts";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden.ts";
import { usePlotContext } from "../context.ts";

type Axis = "x" | "y";

const DEFAULT_FORMAT_OPTIONS: Intl.NumberFormatOptions = {
  maximumFractionDigits: 2,
};

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
  const { measure, x, y } = meta;
  const disabled = disabledProp || plotState.disabled;

  const options: PlotHandleOptions = {
    axis,
    defaultValue,
    disabled,
    measure,
    onValueChange,
    onValueCommitted,
    value: valueProp,
    x,
    y,
  };
  const [controller] = React.useState(() =>
    createPlotHandleController(options)
  );
  // Set on every render, so the handle always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
  const { dragging, position: at, value } = snapshot;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const moves = (along: Axis) => axis === "both" || axis === along;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || disabled) {
      return;
    }
    event.preventDefault();
    if (!event.altKey) {
      inputRef.current?.focus({ focusVisible: false, preventScroll: true });
    }
    controller.press(event.nativeEvent, event.currentTarget);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      controller.reset(event.nativeEvent);
    }
  };

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (controller.keyDown(event.nativeEvent)) {
        event.preventDefault();
      }
    },
    [controller]
  );

  const handleChange = React.useCallback(
    (along: Axis, event: React.ChangeEvent<HTMLInputElement>) => {
      controller.typeAt(
        along,
        Number(event.currentTarget.value),
        event.nativeEvent
      );
    },
    [controller]
  );
  const handleChangeX = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => handleChange("x", event),
    [handleChange]
  );
  const handleChangeY = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => handleChange("y", event),
    [handleChange]
  );

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
        onPointerDown: handlePointerDown,
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
