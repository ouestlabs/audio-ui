import type { Procedure } from "@audio-ui/utils";
import {
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

interface TransportContextValue {
  value: number;
  bufferedValue: number;
  min: number;
  max: number;
  step: number;
  orientation: "horizontal" | "vertical";
  disabled: boolean;
  percentage: number;
  bufferedPercentage: number;
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
  ariaLabel?: string;
  ariaLabelledBy?: string;
  wheelRef: Procedure<Nullable<HTMLDivElement>>;
  onPointerDown: (e: React.PointerEvent) => void;
  onDragStart: (e: React.PointerEvent) => void;
  onDrag: (delta: Point) => void;
  onDragEnd: () => void;
}

const TransportContext = React.createContext<TransportContextValue | null>(
  null
);

function useTransportContext() {
  const context = React.useContext(TransportContext);
  if (!context) {
    throw new Error("Transport components must be used within Transport.Root");
  }
  return context;
}

export namespace Transport {
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
    bufferedValue?: number;
    min?: number;
    max?: number;
    step?: number;
    orientation?: "horizontal" | "vertical";
    disabled?: boolean;
    freezeValuesWhileDragging?: boolean;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    onValueChange?: Procedure<number>;
    onValueCommit?: Procedure<number>;
  }

  export function Root({
    value: controlledValue,
    defaultValue,
    bufferedValue = 0,
    min = 0,
    max = 100,
    step = 1,
    orientation = "horizontal",
    disabled = false,
    freezeValuesWhileDragging = false,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    onValueChange,
    onValueCommit,
    id,
    className,
    children,
    ...props
  }: RootProps) {
    const generatedId = React.useId();
    const elementId = id || generatedId;
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
          const n = Number(val);
          if (Number.isNaN(n) || !Number.isFinite(n)) {
            return min;
          }
          return clamp(n, min, max);
        },
      });

    const value = rawValue ?? min;
    const valueRef = useValueAsRef(value);
    const [isDragging, setIsDragging] = React.useState(false);
    const [optimisticValue, setOptimisticValue] = React.useState<number | null>(
      null
    );
    const [frozenBufferedValue, setFrozenBufferedValue] =
      React.useState(bufferedValue);

    const normalizeValue = React.useCallback(
      (nextValue: number) => {
        const clampedValue = clamp(nextValue, min, max);
        return quantizeRound(clampedValue, step);
      },
      [min, max, step]
    );

    const updateValue = React.useCallback(
      (newValue: number) => {
        const steppedValue = normalizeValue(newValue);
        if (freezeValuesWhileDragging) {
          setOptimisticValue(steppedValue);
        }
        setRawValue(steppedValue);
      },
      [normalizeValue, freezeValuesWhileDragging, setRawValue]
    );

    const commitValue = React.useCallback(
      (newValue: number) => {
        const steppedValue = normalizeValue(newValue);
        setRawValue(steppedValue);
        onValueCommit?.(steppedValue);
      },
      [normalizeValue, setRawValue, onValueCommit]
    );

    const calculateValueFromPoint = React.useCallback(
      (point: Point) => {
        const track = trackRef.current;
        if (!track) {
          return valueRef.current;
        }

        const rect = track.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return valueRef.current;
        }

        if (orientation === "vertical") {
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
        const sensitivity =
          orientation === "vertical"
            ? (max - min) / Math.max(rect.height, 1)
            : (max - min) / Math.max(rect.width, 1);

        return orientation === "vertical"
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
        setIsDragging(true);
        if (freezeValuesWhileDragging) {
          setFrozenBufferedValue(bufferedValue);
        }
        isDragActiveRef.current = true;
        const newValue = calculateValueFromPoint({
          x: e.clientX,
          y: e.clientY,
        });
        dragStartValueRef.current = newValue;
        pendingValueRef.current = newValue;
        updateValue(newValue);
      },
      [
        bufferedValue,
        calculateValueFromPoint,
        freezeValuesWhileDragging,
        updateValue,
      ]
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
      setIsDragging(false);
      setOptimisticValue(null);
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
        const nextValue = clamp(valueRef.current + direction * step, min, max);
        commitValue(quantizeRound(nextValue, step));
      },
    });

    React.useEffect(() => {
      if (!isDragActiveRef.current) {
        dragStartValueRef.current = value;
        pendingValueRef.current = value;
      }
    }, [value]);

    const displayedValue =
      freezeValuesWhileDragging && optimisticValue !== null
        ? optimisticValue
        : value;
    const displayedBufferedValue =
      freezeValuesWhileDragging && isDragging
        ? frozenBufferedValue
        : bufferedValue;

    const percentage = clampUnit((displayedValue - min) / (max - min || 1));
    const bufferedPercentage = clampUnit(
      (displayedBufferedValue - min) / (max - min || 1)
    );

    const contextValue: TransportContextValue = {
      value,
      bufferedValue,
      min,
      max,
      step,
      orientation,
      disabled,
      percentage,
      bufferedPercentage,
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
      ariaLabel,
      ariaLabelledBy,
      wheelRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
    };

    return (
      <TransportContext.Provider value={contextValue}>
        <div
          className={className}
          {...getDataAttributes("transport", { part: "transport-wrapper" })}
          {...props}
        >
          {ariaLabel || ariaLabelledBy ? null : (
            <span className="sr-only" id={`${elementId}-label`}>
              Transport
            </span>
          )}
          {children}
        </div>
      </TransportContext.Provider>
    );
  }

  export interface SliderProps extends React.ComponentProps<"div"> {}

  export function Slider({ className, ...props }: SliderProps) {
    const { disabled, orientation, trackRef, wheelRef } = useTransportContext();
    return (
      <div
        className={className}
        {...getDataAttributes("transport", { orientation, disabled })}
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
    } = useTransportContext();

    const { pointerProps } = usePointerDrag({
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
        {...getDataAttributes("transport", { part: "track" })}
        {...pointerProps}
        {...props}
      />
    );
  }

  export interface RangeProps extends React.ComponentProps<"div"> {}

  export function Range({ className, style, ...props }: RangeProps) {
    const { percentage, orientation } = useTransportContext();
    const clampedPercentage = clampUnit(percentage);

    return (
      <div
        className={className}
        {...getDataAttributes("transport", { part: "range" })}
        style={{
          ...(orientation === "horizontal"
            ? {
                width: "100%",
                height: "100%",
                transform: `scaleX(${clampedPercentage})`,
                transformOrigin: "left center",
                willChange: "transform",
              }
            : {
                width: "100%",
                height: "100%",
                transform: `scaleY(${clampedPercentage})`,
                transformOrigin: "center bottom",
                willChange: "transform",
              }),
          ...style,
        }}
        {...props}
      />
    );
  }

  export interface BufferedRangeProps extends React.ComponentProps<"div"> {}

  export function BufferedRange({
    className,
    style,
    ...props
  }: BufferedRangeProps) {
    const { bufferedPercentage, orientation } = useTransportContext();
    const clampedBufferedPercentage = clampUnit(bufferedPercentage);
    return (
      <div
        className={className}
        {...getDataAttributes("transport", { part: "buffered-range" })}
        style={{
          ...(orientation === "horizontal"
            ? {
                width: "100%",
                height: "100%",
                transform: `scaleX(${clampedBufferedPercentage})`,
                transformOrigin: "left center",
                willChange: "transform",
              }
            : {
                width: "100%",
                height: "100%",
                transform: `scaleY(${clampedBufferedPercentage})`,
                transformOrigin: "center bottom",
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
    } = useTransportContext();

    const { pointerProps } = usePointerDrag({
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

    const baseTransform =
      orientation === "horizontal"
        ? "translate(-50%, -50%)"
        : "translate(-50%, 50%)";

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
        {...getDataAttributes("transport", { part: "thumb", disabled })}
        ref={thumbRef}
        role="slider"
        style={{
          ...(orientation === "horizontal"
            ? { left: `${percentage * 100}%`, top: "50%" }
            : { bottom: `${percentage * 100}%`, left: "50%" }),
          transform: baseTransform,
          ...style,
        }}
        {...keyboardProps}
        {...pointerProps}
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
        {...getDataAttributes("transport", { part: "thumb-inner" })}
        {...props}
      />
    );
  }

  export interface ThumbMarkProps extends React.ComponentProps<"div"> {}

  export function ThumbMark({ className, ...props }: ThumbMarkProps) {
    return (
      <div
        className={className}
        {...getDataAttributes("transport", { part: "thumb-mark" })}
        {...props}
      />
    );
  }
}
