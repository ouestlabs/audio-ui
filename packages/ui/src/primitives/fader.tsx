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
import { useInheritedOrientation } from "./internal/orientation-context";

interface FaderContextValue {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  calculateValueFromDelta: (delta: Point, initialValue: number) => number;
  calculateValueFromPoint: (point: Point) => number;
  commitValue: (newValue: number) => void;
  disabled: boolean;
  dragStartValueRef: React.RefObject<number>;
  elementId: string;
  isDragActiveRef: React.RefObject<boolean>;
  max: number;
  min: number;
  onDrag: (delta: Point) => void;
  onDragEnd: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onValueCommit?: Procedure<number>;
  orientation: "horizontal" | "vertical";
  pendingValueRef: React.RefObject<number>;
  percentage: number;
  setRawValue: Procedure<number>;
  shouldPreventFocusRef: React.RefObject<boolean>;
  step: number;
  thumbRef: React.RefObject<Nullable<HTMLDivElement>>;
  trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  updateValue: (newValue: number) => void;
  value: number;
  valueRef: React.RefObject<number>;
  wheelRef: Procedure<Nullable<HTMLDivElement>>;
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
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: number;
    disabled?: boolean;
    max?: number;
    min?: number;
    onValueChange?: Procedure<number>;
    onValueCommit?: Procedure<number>;
    orientation?: "horizontal" | "vertical";
    step?: number;
    value?: number | number[];
  }

  export function Root({
    value: controlledValue,
    defaultValue,
    min = -60,
    max = 6,
    step = 1,
    orientation: orientationProp,
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
    const inheritedOrientation = useInheritedOrientation();
    const orientation = orientationProp ?? inheritedOrientation ?? "vertical";

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
        defaultValue: computedDefaultValue,
        onChange: onValueChange,
        transform: (val: number) => {
          const numValue = Number(val);
          if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
            return min;
          }
          return clamp(numValue, min, max);
        },
        value: normalizedValue,
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
      ariaLabel,
      ariaLabelledBy,
      calculateValueFromDelta,
      calculateValueFromPoint,
      commitValue,
      disabled,
      dragStartValueRef,
      elementId,
      isDragActiveRef,
      max,
      min,
      onDrag,
      onDragEnd,
      onDragStart,
      onPointerDown,
      onValueCommit,
      orientation,
      pendingValueRef,
      percentage,
      setRawValue,
      shouldPreventFocusRef,
      step,
      thumbRef,
      trackRef,
      updateValue,
      value,
      valueRef,
      wheelRef,
    };

    return (
      <FaderContext.Provider value={contextValue}>
        <div
          className={className}
          {...getDataAttributes("fader", { part: "fader-wrapper" })}
          {...props}
        >
          {ariaLabel || ariaLabelledBy ? null : (
            <span className="sr-only" id={`${elementId}-label`}>
              Fader
            </span>
          )}
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
        {...getDataAttributes("fader", { disabled, orientation })}
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
      orientation,
      trackRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
    } = useFaderContext();

    const { pointerProps: trackPointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: trackRef,
      onDrag,
      onDragEnd,
      onDragStart,
      onPointerDown,
    });

    return (
      <div
        className={className}
        {...getDataAttributes("fader", { orientation, part: "track" })}
        {...trackPointerProps}
        {...props}
      />
    );
  }

  export interface RangeProps extends React.ComponentProps<"div"> {}

  export function Range({ className, style, ...props }: RangeProps) {
    const { percentage, orientation } = useFaderContext();
    const clampedPercentage = clampUnit(percentage);

    return (
      <div
        className={className}
        {...getDataAttributes("fader", { orientation, part: "range" })}
        style={{
          ...(orientation === "horizontal"
            ? {
                height: "100%",
                transform: `scaleX(${clampedPercentage})`,
                transformOrigin: "left center",
                width: "100%",
                willChange: "transform",
              }
            : {
                height: "100%",
                transform: `scaleY(${clampedPercentage})`,
                transformOrigin: "center bottom",
                width: "100%",
                willChange: "transform",
              }),
          ...style,
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
        capturePointer: true,
        disabled,
        elementRef: thumbRef,
        onDrag,
        onDragEnd,
        onDragStart,
        onPointerDown,
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
        onArrowDown: () => {
          commitValue(valueRef.current - step);
          return true;
        },
        onArrowLeft: () => {
          commitValue(valueRef.current - step);
          return true;
        },
        onArrowRight: () => {
          commitValue(valueRef.current + step);
          return true;
        },
        onArrowUp: () => {
          commitValue(valueRef.current + step);
          return true;
        },
        onEnd: () => {
          commitValue(max);
          return true;
        },
        onHome: () => {
          commitValue(min);
          return true;
        },
        onPageDown: () => {
          commitValue(valueRef.current - step * 10);
          return true;
        },
        onPageUp: () => {
          commitValue(valueRef.current + step * 10);
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

    const baseTransform =
      orientation === "horizontal" ? "translateX(-50%)" : "translateY(50%)";
    const transform = style?.transform
      ? `${baseTransform} ${style.transform}`
      : baseTransform;

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
        {...getDataAttributes("fader", {
          disabled,
          orientation,
          part: "thumb",
        })}
        ref={thumbRef}
        role="slider"
        style={{
          ...(orientation === "horizontal"
            ? { left: `${percentage * 100}%` }
            : { bottom: `${percentage * 100}%` }),
          ...style,
          transform,
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
    const { orientation } = useFaderContext();

    return (
      <div
        className={className}
        {...getDataAttributes("fader", { orientation, part: "thumb-inner" })}
        {...props}
      />
    );
  }

  export interface ThumbMarkProps extends React.ComponentProps<"div"> {}

  export function ThumbMark({ className, ...props }: ThumbMarkProps) {
    const { orientation } = useFaderContext();

    return (
      <div
        className={className}
        {...getDataAttributes("fader", { orientation, part: "thumb-mark" })}
        {...props}
      />
    );
  }
}
