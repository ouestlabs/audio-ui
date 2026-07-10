import type { Procedure } from "@audio-ui/utils";
import { clampUnit, type Nullable, type Point } from "@audio-ui/utils";
import * as React from "react";
import { useFocus } from "../hooks/interactions/use-focus";
import { usePointerDrag } from "../hooks/interactions/use-pointer-drag";
import { getDataAttributes } from "./internal/data-attributes";
import { useInheritedOrientation } from "./internal/orientation-context";
import {
  type UseParameterDragCallbacks,
  useParameter,
} from "./internal/use-parameter";

interface TransportConfigContextValue {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  disabled: boolean;
  dragCallbacks: UseParameterDragCallbacks;
  elementId: string;
  keyboardProps: { onKeyDown: Procedure<React.KeyboardEvent> };
  max: number;
  min: number;
  orientation: "horizontal" | "vertical";
  shouldPreventFocusRef: React.RefObject<boolean>;
  thumbRef: React.RefObject<Nullable<HTMLDivElement>>;
  trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  wheelRef: Procedure<Nullable<HTMLDivElement>>;
}

/** Split from config: changes every drag frame, so only components that render live position subscribe to it. */
interface TransportValueContextValue {
  bufferedPercentage: number;
  bufferedValue: number;
  percentage: number;
  value: number;
}

const TransportConfigContext =
  React.createContext<TransportConfigContextValue | null>(null);
const TransportValueContext =
  React.createContext<TransportValueContextValue | null>(null);

function useTransportConfigContext() {
  const context = React.useContext(TransportConfigContext);
  if (!context) {
    throw new Error("Transport components must be used within Transport.Root");
  }
  return context;
}

function useTransportValueContext() {
  const context = React.useContext(TransportValueContext);
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
    "aria-label"?: string;
    "aria-labelledby"?: string;
    bufferedValue?: number;
    defaultValue?: number;
    disabled?: boolean;
    freezeValuesWhileDragging?: boolean;
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
    bufferedValue = 0,
    min = 0,
    max = 100,
    step = 1,
    orientation: orientationProp,
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
    const inheritedOrientation = useInheritedOrientation();
    const orientation = orientationProp ?? inheritedOrientation ?? "horizontal";
    const generatedId = React.useId();
    const elementId = id || generatedId;
    const trackRef = React.useRef<HTMLDivElement>(null);
    const thumbRef = React.useRef<HTMLDivElement>(null);

    const normalizedValue = Array.isArray(controlledValue)
      ? controlledValue[0]
      : controlledValue;

    const calculateValueFromPoint = React.useCallback(
      (point: Point): Nullable<number> => {
        const track = trackRef.current;
        if (!track) {
          return null;
        }

        const rect = track.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return null;
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
      [orientation, min, max]
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

    const containsTarget = React.useCallback(
      (target: Node) =>
        Boolean(
          thumbRef.current?.contains(target) ||
            trackRef.current?.contains(target)
        ),
      []
    );

    const {
      dragCallbacks: parameterDragCallbacks,
      isDragging,
      keyboardProps,
      percentage,
      shouldPreventFocusRef,
      value,
      wheelRef,
    } = useParameter({
      containsTarget,
      defaultValue,
      deltaToValue: calculateValueFromDelta,
      disabled,
      focusRef: thumbRef,
      freezeWhileDragging: freezeValuesWhileDragging,
      max,
      min,
      onValueChange,
      onValueCommit,
      pointToValue: calculateValueFromPoint,
      step,
      value: normalizedValue,
    });

    const [frozenBufferedValue, setFrozenBufferedValue] =
      React.useState(bufferedValue);

    const dragCallbacks = React.useMemo<UseParameterDragCallbacks>(
      () => ({
        ...parameterDragCallbacks,
        onDragStart: (e: React.PointerEvent) => {
          if (freezeValuesWhileDragging) {
            setFrozenBufferedValue(bufferedValue);
          }
          parameterDragCallbacks.onDragStart(e);
        },
      }),
      [parameterDragCallbacks, freezeValuesWhileDragging, bufferedValue]
    );

    const displayedBufferedValue =
      freezeValuesWhileDragging && isDragging
        ? frozenBufferedValue
        : bufferedValue;
    const bufferedPercentage = clampUnit(
      (displayedBufferedValue - min) / (max - min || 1)
    );

    const configValue = React.useMemo<TransportConfigContextValue>(
      () => ({
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragCallbacks,
        elementId,
        keyboardProps,
        max,
        min,
        orientation,
        shouldPreventFocusRef,
        thumbRef,
        trackRef,
        wheelRef,
      }),
      [
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragCallbacks,
        elementId,
        keyboardProps,
        max,
        min,
        orientation,
        shouldPreventFocusRef,
        wheelRef,
      ]
    );

    const valueContextValue = React.useMemo<TransportValueContextValue>(
      () => ({ bufferedPercentage, bufferedValue, percentage, value }),
      [bufferedPercentage, bufferedValue, percentage, value]
    );

    return (
      <TransportConfigContext.Provider value={configValue}>
        <TransportValueContext.Provider value={valueContextValue}>
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
        </TransportValueContext.Provider>
      </TransportConfigContext.Provider>
    );
  }

  export interface SliderProps extends React.ComponentProps<"div"> {}

  export function Slider({ className, ...props }: SliderProps) {
    const { disabled, orientation, trackRef, wheelRef } =
      useTransportConfigContext();
    return (
      <div
        className={className}
        {...getDataAttributes("transport", { disabled, orientation })}
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
    const { disabled, orientation, trackRef, dragCallbacks } =
      useTransportConfigContext();

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: trackRef,
      ...dragCallbacks,
    });

    return (
      <div
        className={className}
        {...getDataAttributes("transport", { orientation, part: "track" })}
        {...pointerProps}
        {...props}
      />
    );
  }

  export interface RangeProps extends React.ComponentProps<"div"> {}

  export function Range({ className, style, ...props }: RangeProps) {
    const { orientation } = useTransportConfigContext();
    const { percentage } = useTransportValueContext();
    const clampedPercentage = clampUnit(percentage);

    return (
      <div
        className={className}
        {...getDataAttributes("transport", { orientation, part: "range" })}
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

  export interface BufferedRangeProps extends React.ComponentProps<"div"> {}

  export function BufferedRange({
    className,
    style,
    ...props
  }: BufferedRangeProps) {
    const { orientation } = useTransportConfigContext();
    const { bufferedPercentage } = useTransportValueContext();
    const clampedBufferedPercentage = clampUnit(bufferedPercentage);
    return (
      <div
        className={className}
        {...getDataAttributes("transport", {
          orientation,
          part: "buffered-range",
        })}
        style={{
          ...(orientation === "horizontal"
            ? {
                height: "100%",
                transform: `scaleX(${clampedBufferedPercentage})`,
                transformOrigin: "left center",
                width: "100%",
                willChange: "transform",
              }
            : {
                height: "100%",
                transform: `scaleY(${clampedBufferedPercentage})`,
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
      ariaLabel,
      ariaLabelledBy,
      disabled,
      dragCallbacks,
      elementId,
      keyboardProps,
      max,
      min,
      orientation,
      shouldPreventFocusRef,
      thumbRef,
    } = useTransportConfigContext();
    const { percentage, value } = useTransportValueContext();

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: thumbRef,
      ...dragCallbacks,
    });

    const { focusProps } = useFocus({
      disabled,
      onFocus: () => {
        if (shouldPreventFocusRef.current) {
          shouldPreventFocusRef.current = false;
        }
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
        {...getDataAttributes("transport", {
          disabled,
          orientation,
          part: "thumb",
        })}
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
    const { orientation } = useTransportConfigContext();

    return (
      <div
        className={className}
        {...getDataAttributes("transport", {
          orientation,
          part: "thumb-inner",
        })}
        {...props}
      />
    );
  }

  export interface ThumbMarkProps extends React.ComponentProps<"div"> {}

  export function ThumbMark({ className, ...props }: ThumbMarkProps) {
    const { orientation } = useTransportConfigContext();

    return (
      <div
        className={className}
        {...getDataAttributes("transport", {
          orientation,
          part: "thumb-mark",
        })}
        {...props}
      />
    );
  }
}
