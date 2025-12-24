import type { Procedure } from "@audio-ui/utils";
import {
  assertType,
  clamp,
  clampUnit,
  type Nullable,
  type Point,
  quantizeRound,
} from "@audio-ui/utils";
import * as React from "react";
import {
  useFocus,
  useKeyboardNavigation,
  usePointerDrag,
  useWheel,
} from "../hooks/interactions";
import { useControlledValue, useValueAsRef } from "../hooks/state";
import { getDataAttributes } from "./internal/data-attributes";

interface FaderContextValue {
  value: number;
  min: number;
  max: number;
  step: number;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  percentage: number;
  elementId: string;
  trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  thumbRef: React.RefObject<Nullable<HTMLDivElement>>;
  updateValue: (newValue: number) => void;
  commitValue: (newValue: number) => void;
  calculateValueFromPoint: (point: Point) => number;
  calculateValueFromDelta: (delta: Point, initialValue: number) => number;
  dragStartValueRef: React.RefObject<number>;
  isDragActiveRef: React.RefObject<boolean>;
  pendingValueRef: React.RefObject<number>;
  shouldPreventFocusRef: React.RefObject<boolean>;
  valueRef: React.RefObject<number>;
  setRawValue: Procedure<number>;
  onValueCommit?: Procedure<number>;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  wheelRef: Procedure<Nullable<HTMLDivElement>>;
  onPointerDown: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onDrag: (delta: Point) => void;
  onDragEnd: () => void;
}

const FaderContext = React.createContext<FaderContextValue | null>(null);

function useFaderContext() {
  const context = React.useContext(FaderContext);
  if (!context) {
    throw new Error("Fader components must be used within Fader.Root");
  }
  return context;
}

export namespace Fader {
  export interface RootProps
    extends Omit<
      React.ComponentProps<"div">,
      | "onChange"
      | "onInput"
      | "type"
      | "value"
      | "defaultValue"
      | "min"
      | "max"
      | "step"
    > {
    value?: number | number[];
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    orientation?: "horizontal" | "vertical";
    disabled?: boolean;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    onValueChange?: Procedure<number>;
    onValueCommit?: Procedure<number>;
  }

  export function Root({
    value: controlledValue,
    defaultValue,
    min = -60,
    max = 6,
    step = 1,
    orientation = "vertical",
    disabled = false,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    onValueChange,
    onValueCommit,
    id,
    className,
    children,
    ...props
  }: RootProps) {
    const faderId = React.useId();
    const trackRef = React.useRef<HTMLDivElement>(null);
    const thumbRef = React.useRef<HTMLDivElement>(null);

    const normalizedValue = Array.isArray(controlledValue)
      ? controlledValue[0]
      : controlledValue;

    const computedDefaultValue =
      defaultValue ?? (max < min ? min : min + (max - min) / 2);

    const { value: rawValue, setValue: setRawValue } =
      useControlledValue<number>({
        value: normalizedValue,
        defaultValue: computedDefaultValue,
        onChange: onValueChange,
        transform: (val: number) => {
          const numValue = Number(val);
          if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
            return min;
          }
          return clamp(numValue, min, max);
        },
      });

    const value = rawValue ?? min;
    const valueRef = useValueAsRef(value);

    const updateValue = React.useCallback(
      (newValue: number) => {
        const clampedValue = clamp(newValue, min, max);
        const steppedValue = quantizeRound(clampedValue, step);
        setRawValue(steppedValue);
      },
      [min, max, step, setRawValue]
    );

    const commitValue = React.useCallback(
      (newValue: number) => {
        const clampedValue = clamp(newValue, min, max);
        const steppedValue = quantizeRound(clampedValue, step);
        setRawValue(steppedValue);
        onValueCommit?.(steppedValue);
      },
      [min, max, step, setRawValue, onValueCommit]
    );

    const calculateValueFromPoint = React.useCallback(
      (point: Point) => {
        const track = trackRef.current;
        if (!track) {
          return valueRef.current;
        }

        const rect = track.getBoundingClientRect();
        const isVertical = orientation === "vertical";

        if (isVertical) {
          const clickY = point.y - rect.top;
          const percentage = 1 - clampUnit(clickY / rect.height);
          return min + percentage * (max - min);
        }

        const clickX = point.x - rect.left;
        const percentage = clampUnit(clickX / rect.width);
        return min + percentage * (max - min);
      },
      [orientation, min, max, valueRef]
    );

    const calculateValueFromDelta = React.useCallback(
      (delta: Point, initialValue: number) => {
        const track = trackRef.current;
        if (!track) {
          return initialValue;
        }

        const rect = track.getBoundingClientRect();
        const isVertical = orientation === "vertical";
        const sensitivity = isVertical
          ? (max - min) / rect.height
          : (max - min) / rect.width;

        return isVertical
          ? initialValue + delta.y * sensitivity
          : initialValue + delta.x * sensitivity;
      },
      [orientation, min, max]
    );

    const dragStartValueRef = React.useRef(value);
    const isDragActiveRef = React.useRef(false);
    const pendingValueRef = React.useRef(value);
    const shouldPreventFocusRef = React.useRef(false);

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        shouldPreventFocusRef.current = true;
        e.preventDefault();
        if (thumbRef.current && !disabled) {
          thumbRef.current.focus();
        }
      },
      [disabled]
    );

    const onDragStart = React.useCallback(
      (e: React.PointerEvent) => {
        isDragActiveRef.current = true;
        const newValue = calculateValueFromPoint({
          x: e.clientX,
          y: e.clientY,
        });
        dragStartValueRef.current = newValue;
        pendingValueRef.current = newValue;
        updateValue(newValue);
      },
      [calculateValueFromPoint, updateValue]
    );

    const onDrag = React.useCallback(
      (delta: Point) => {
        const newValue = calculateValueFromDelta(
          delta,
          dragStartValueRef.current
        );
        pendingValueRef.current = newValue;
        updateValue(newValue);
      },
      [calculateValueFromDelta, updateValue]
    );

    const onDragEnd = React.useCallback(() => {
      isDragActiveRef.current = false;
      commitValue(pendingValueRef.current);
    }, [commitValue]);

    const { wheelRef } = useWheel({
      disabled,
      elementRef: trackRef,
      onWheel: (delta: Point) => {
        if (Math.abs(delta.y) < 0.1) {
          return;
        }
        const direction = delta.y < 0 ? 1 : -1;
        const deltaValue = direction * step;
        const newValue = clamp(valueRef.current + deltaValue, min, max);
        commitValue(quantizeRound(newValue, step));
      },
    });

    React.useEffect(() => {
      if (!isDragActiveRef.current) {
        dragStartValueRef.current = value;
        pendingValueRef.current = value;
      }
    }, [value]);

    const percentage = (value - min) / (max - min);
    const elementId = id || faderId;

    const contextValue: FaderContextValue = {
      value,
      min,
      max,
      step,
      orientation,
      disabled,
      percentage,
      elementId,
      trackRef,
      thumbRef,
      updateValue,
      commitValue,
      calculateValueFromPoint,
      calculateValueFromDelta,
      dragStartValueRef,
      isDragActiveRef,
      pendingValueRef,
      shouldPreventFocusRef,
      valueRef,
      setRawValue,
      onValueCommit,
      ariaLabel,
      ariaLabelledBy,
      wheelRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
    };

    return (
      <FaderContext.Provider value={contextValue}>
        <div
          className={className}
          {...getDataAttributes("fader", { part: "wrapper" })}
          {...props}
        >
          {children}
        </div>
      </FaderContext.Provider>
    );
  }

  export interface SliderProps extends React.ComponentProps<"div"> {}

  export function Slider({ className, ...props }: SliderProps) {
    const { disabled, orientation, trackRef, wheelRef } = useFaderContext();

    return (
      <div
        className={className}
        {...getDataAttributes("fader", { orientation, disabled })}
        ref={(node) => {
          trackRef.current = node;
          wheelRef(node);
        }}
        {...props}
      />
    );
  }

  export interface TrackProps extends React.ComponentProps<"div"> {}

  export function Track({ className, ...props }: TrackProps) {
    const {
      disabled,
      trackRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
    } = useFaderContext();

    const { pointerProps: trackPointerProps } = usePointerDrag({
      disabled,
      elementRef: trackRef,
      capturePointer: true,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
    });

    return (
      <div
        className={className}
        {...getDataAttributes("fader", { part: "track" })}
        {...trackPointerProps}
        {...props}
      />
    );
  }

  export interface RangeProps extends React.ComponentProps<"div"> {}

  export function Range({ className, style, ...props }: RangeProps) {
    const { percentage, orientation } = useFaderContext();
    return (
      <div
        className={className}
        {...getDataAttributes("fader", { part: "range" })}
        style={{
          ...style,
          ...(orientation === "horizontal"
            ? { width: `${percentage * 100}%` }
            : { height: `${percentage * 100}%` }),
        }}
        {...props}
      />
    );
  }

  export interface ThumbProps extends React.ComponentProps<"div"> {}

  export function Thumb({ className, style, ...props }: ThumbProps) {
    const {
      disabled,
      orientation,
      percentage,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      min,
      max,
      value,
      thumbRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
      shouldPreventFocusRef,
      valueRef,
      step,
      commitValue,
    } = useFaderContext();

    const { pointerProps: thumbPointerProps, isDragging: isThumbDragging } =
      usePointerDrag({
        disabled,
        elementRef: thumbRef,
        capturePointer: true,
        onPointerDown,
        onDragStart,
        onDrag,
        onDragEnd,
      });

    const { focusProps } = useFocus({
      disabled,
      onFocus: () => {
        if (shouldPreventFocusRef.current) {
          shouldPreventFocusRef.current = false;
        }
      },
    });

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowUp: () => {
          commitValue(valueRef.current + step);
          return true;
        },
        onArrowRight: () => {
          commitValue(valueRef.current + step);
          return true;
        },
        onArrowDown: () => {
          commitValue(valueRef.current - step);
          return true;
        },
        onArrowLeft: () => {
          commitValue(valueRef.current - step);
          return true;
        },
        onHome: () => {
          commitValue(min);
          return true;
        },
        onEnd: () => {
          commitValue(max);
          return true;
        },
        onPageUp: () => {
          commitValue(valueRef.current + step * 10);
          return true;
        },
        onPageDown: () => {
          commitValue(valueRef.current - step * 10);
          return true;
        },
      },
    });

    const {
      isDragActiveRef,
      pendingValueRef,
      setRawValue,
      onValueCommit,
      trackRef: contextTrackRef,
    } = useFaderContext();

    React.useEffect(() => {
      if (!isThumbDragging) {
        return;
      }

      const abortController = new AbortController();
      const { signal } = abortController;

      const handlePointerDown = (e: PointerEvent) => {
        if (signal.aborted) {
          return;
        }

        const target = e.target;
        if (!(target instanceof Node)) {
          return;
        }
        assertType<Node>(target);
        const thumb = thumbRef.current;
        const track = contextTrackRef.current;
        const isInside = thumb?.contains(target) || track?.contains(target);

        if (!isInside && isDragActiveRef.current) {
          isDragActiveRef.current = false;
          const pendingValue = pendingValueRef.current;
          const clampedValue = clamp(pendingValue, min, max);
          const steppedValue = quantizeRound(clampedValue, step);
          setRawValue(steppedValue);
          onValueCommit?.(steppedValue);
        }
      };

      document.addEventListener("pointerdown", handlePointerDown, {
        capture: true,
        signal,
      });

      return () => {
        abortController.abort();
      };
    }, [
      isThumbDragging,
      min,
      max,
      step,
      thumbRef,
      contextTrackRef,
      isDragActiveRef,
      pendingValueRef,
      setRawValue,
      onValueCommit,
    ]);

    return (
      <div
        aria-disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        aria-orientation={orientation}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className={className}
        {...getDataAttributes("fader", { part: "thumb", disabled })}
        ref={thumbRef}
        role="slider"
        style={{
          ...style,
          ...(orientation === "horizontal"
            ? { left: `calc(${percentage * 100}% - 10px)` }
            : { bottom: `calc(${percentage * 100}% - 10px)` }),
        }}
        {...keyboardProps}
        {...thumbPointerProps}
        {...focusProps}
        onFocus={(e) => {
          if (shouldPreventFocusRef.current) {
            shouldPreventFocusRef.current = false;
          }
          focusProps.onFocus(e);
        }}
        tabIndex={disabled ? -1 : focusProps.tabIndex}
        {...props}
      />
    );
  }

  export interface ThumbInnerProps extends React.ComponentProps<"div"> {}

  export function ThumbInner({ className, ...props }: ThumbInnerProps) {
    return (
      <div
        className={className}
        {...getDataAttributes("fader", { part: "thumb-inner" })}
        {...props}
      />
    );
  }

  export interface ThumbMarkProps extends React.ComponentProps<"div"> {}

  export function ThumbMark({ className, ...props }: ThumbMarkProps) {
    return (
      <div
        className={className}
        {...getDataAttributes("fader", { part: "thumb-mark" })}
        {...props}
      />
    );
  }
}
