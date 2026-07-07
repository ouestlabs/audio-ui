import type { Func, Nullable, Procedure } from "@audio-ui/utils";
import {
  clamp,
  clampUnit,
  type Point,
  panic,
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

export namespace XYPad {
  interface ContextValue {
    ariaLabel?: string;
    ariaLabelledBy?: string;
    calculateValueFromDelta: (delta: Point, initialValue: Point) => Point;
    calculateValueFromPoint: Func<Point, Point>;
    commitValue: Procedure<Point>;
    containerRef: React.RefObject<Nullable<HTMLDivElement>>;
    disabled: boolean;
    dragStartValueRef: React.RefObject<Point>;
    elementId: string;
    isDragActiveRef: React.RefObject<boolean>;
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
    onDrag: Procedure<Point>;
    onDragEnd: () => void;
    onDragStart: Procedure<React.PointerEvent>;
    onPointerDown: Procedure<React.PointerEvent>;
    onValueCommit?: Procedure<Point>;
    pendingValueRef: React.RefObject<Point>;
    percentageX: number;
    percentageY: number;
    setRawValue: Procedure<Point>;
    shouldPreventFocusRef: React.RefObject<boolean>;
    stepX: number;
    stepY: number;
    thumbX: number;
    thumbY: number;
    updateValue: Procedure<Point>;
    value: Point;
    valueRef: React.RefObject<Point>;
    wheelRef: Procedure<Nullable<HTMLDivElement>>;
  }

  const Context = React.createContext<ContextValue | null>(null);

  function useContext() {
    const context = React.useContext(Context);
    if (!context) {
      panic("XYPad components must be used within XYPad.Root");
    }
    return context;
  }
  export interface RootProps
    extends Omit<
      React.ComponentProps<"div">,
      "onChange" | "onInput" | "type" | "value" | "defaultValue"
    > {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: Point;
    disabled?: boolean;
    maxX?: number;
    maxY?: number;
    minX?: number;
    minY?: number;
    onValueChange?: Procedure<Point>;
    onValueCommit?: Procedure<Point>;
    stepX?: number;
    stepY?: number;
    value?: Point;
  }

  export function Root({
    value: controlledValue,
    defaultValue = { x: 0, y: 0 },
    minX = 0,
    maxX = 100,
    minY = 0,
    maxY = 100,
    stepX = 1,
    stepY = 1,
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
    const xypadId = React.useId();
    const containerRef = React.useRef<HTMLDivElement>(null);

    const computedDefaultValue = defaultValue ?? {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };

    const { value: rawValue, setValue: setRawValue } =
      useControlledValue<Point>({
        defaultValue: computedDefaultValue,
        onChange: onValueChange,
        transform: (val: Point) => {
          const numX = Number(val.x);
          const numY = Number(val.y);
          const clampedX =
            Number.isNaN(numX) || !Number.isFinite(numX)
              ? minX
              : clamp(numX, minX, maxX);
          const clampedY =
            Number.isNaN(numY) || !Number.isFinite(numY)
              ? minY
              : clamp(numY, minY, maxY);
          return { x: clampedX, y: clampedY };
        },
        value: controlledValue,
      });

    const value = rawValue ?? { x: minX, y: minY };
    const valueRef = useValueAsRef(value);

    const updateValue = React.useCallback(
      (newValue: Point) => {
        const clampedX = clamp(newValue.x, minX, maxX);
        const clampedY = clamp(newValue.y, minY, maxY);
        const steppedX = quantizeRound(clampedX, stepX);
        const steppedY = quantizeRound(clampedY, stepY);
        setRawValue({ x: steppedX, y: steppedY });
      },
      [minX, maxX, minY, maxY, stepX, stepY, setRawValue]
    );

    const commitValue = React.useCallback(
      (newValue: Point) => {
        const clampedX = clamp(newValue.x, minX, maxX);
        const clampedY = clamp(newValue.y, minY, maxY);
        const steppedX = quantizeRound(clampedX, stepX);
        const steppedY = quantizeRound(clampedY, stepY);
        setRawValue({ x: steppedX, y: steppedY });
        onValueCommit?.({ x: steppedX, y: steppedY });
      },
      [minX, maxX, minY, maxY, stepX, stepY, setRawValue, onValueCommit]
    );

    const calculateValueFromPoint = React.useCallback(
      (point: Point) => {
        const container = containerRef.current;
        if (!container) {
          return valueRef.current;
        }

        const rect = container.getBoundingClientRect();
        const normalizedX = clampUnit((point.x - rect.left) / rect.width);
        const normalizedY = clampUnit((point.y - rect.top) / rect.height);

        return {
          x: minX + normalizedX * (maxX - minX),
          y: maxY - normalizedY * (maxY - minY),
        };
      },
      [minX, maxX, minY, maxY, valueRef]
    );

    const calculateValueFromDelta = React.useCallback(
      (delta: Point, initialValue: Point) => {
        const container = containerRef.current;
        if (!container) {
          return initialValue;
        }

        const rect = container.getBoundingClientRect();
        const sensitivityX = (maxX - minX) / rect.width;
        const sensitivityY = (maxY - minY) / rect.height;

        return {
          x: initialValue.x + delta.x * sensitivityX,
          y: initialValue.y + delta.y * sensitivityY,
        };
      },
      [minX, maxX, minY, maxY]
    );

    const dragStartValueRef = React.useRef(value);
    const isDragActiveRef = React.useRef(false);
    const pendingValueRef = React.useRef(value);
    const shouldPreventFocusRef = React.useRef(false);

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        shouldPreventFocusRef.current = true;
        e.preventDefault();
        if (containerRef.current && !disabled) {
          containerRef.current.focus();
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
      elementRef: containerRef,
      onWheel: (delta: Point) => {
        const container = containerRef.current;
        if (!container) {
          return;
        }

        const rect = container.getBoundingClientRect();
        const sensitivityX = (maxX - minX) / rect.width;
        const sensitivityY = (maxY - minY) / rect.height;

        const deltaX = -delta.x * sensitivityX;
        const deltaY = delta.y * sensitivityY;

        const newValue = {
          x: clamp(valueRef.current.x + deltaX, minX, maxX),
          y: clamp(valueRef.current.y + deltaY, minY, maxY),
        };

        commitValue({
          x: quantizeRound(newValue.x, stepX),
          y: quantizeRound(newValue.y, stepY),
        });
      },
    });

    React.useEffect(() => {
      if (!isDragActiveRef.current) {
        dragStartValueRef.current = value;
        pendingValueRef.current = value;
      }
    }, [value]);

    const percentageX = (value.x - minX) / (maxX - minX);
    const percentageY = (value.y - minY) / (maxY - minY);
    const thumbX = percentageX * 100;
    const thumbY = (1 - percentageY) * 100;
    const elementId = id || xypadId;

    const contextValue: ContextValue = {
      ariaLabel,
      ariaLabelledBy,
      calculateValueFromDelta,
      calculateValueFromPoint,
      commitValue,
      containerRef,
      disabled,
      dragStartValueRef,
      elementId,
      isDragActiveRef,
      maxX,
      maxY,
      minX,
      minY,
      onDrag,
      onDragEnd,
      onDragStart,
      onPointerDown,
      onValueCommit,
      pendingValueRef,
      percentageX,
      percentageY,
      setRawValue,
      shouldPreventFocusRef,
      stepX,
      stepY,
      thumbX,
      thumbY,
      updateValue,
      value,
      valueRef,
      wheelRef,
    };

    return (
      <Context.Provider value={contextValue}>
        <div className={className} {...props}>
          {ariaLabel || ariaLabelledBy ? null : (
            <span className="sr-only" id={`${elementId}-label`}>
              XY Pad
            </span>
          )}
          <span className="sr-only" id={`${elementId}-instructions`}>
            Use arrow keys to adjust X and Y values.
          </span>
          {children}
        </div>
      </Context.Provider>
    );
  }

  export function Slider({
    className,
    "aria-describedby": ariaDescribedBy,
    ...props
  }: React.ComponentProps<"div">) {
    const context = useContext();
    const {
      disabled,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      containerRef,
      wheelRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
      shouldPreventFocusRef,
      commitValue,
      valueRef,
      stepX,
      stepY,
      minX,
      maxX,
      minY,
      maxY,
    } = context;

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: containerRef,
      onDrag,
      onDragEnd,
      onDragStart,
      onPointerDown,
      releaseOnOutsideClick: true,
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
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y - stepY,
          });
          return true;
        },
        onArrowLeft: () => {
          commitValue({
            x: valueRef.current.x - stepX,
            y: valueRef.current.y,
          });
          return true;
        },
        onArrowRight: () => {
          commitValue({
            x: valueRef.current.x + stepX,
            y: valueRef.current.y,
          });
          return true;
        },
        onArrowUp: () => {
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y + stepY,
          });
          return true;
        },
        onEnd: () => {
          commitValue({ x: maxX, y: minY });
          return true;
        },
        onHome: () => {
          commitValue({ x: minX, y: maxY });
          return true;
        },
        onPageDown: () => {
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y - stepY * 10,
          });
          return true;
        },
        onPageUp: () => {
          commitValue({
            x: valueRef.current.x,
            y: valueRef.current.y + stepY * 10,
          });
          return true;
        },
      },
    });

    return (
      <div
        aria-describedby={ariaDescribedBy || `${elementId}-instructions`}
        aria-disabled={disabled}
        aria-label={ariaLabel || "XY Pad"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        className={className}
        {...getDataAttributes("xypad", { disabled })}
        ref={(node) => {
          containerRef.current = node;
          wheelRef(node);
        }}
        role="group"
        {...focusProps}
        {...keyboardProps}
        {...pointerProps}
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

  export interface GridProps extends React.ComponentProps<"div"> {}

  export function Grid({ className, ...props }: GridProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "grid" })}
        {...props}
      />
    );
  }

  export interface GridLineProps extends React.ComponentProps<"div"> {
    orientation: "vertical" | "horizontal";
    position: number;
  }

  export function GridLine({
    className,
    orientation,
    position,
    ...props
  }: GridLineProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", {
          "grid-horizontal-line": orientation === "horizontal",
          "grid-vertical-line": orientation === "vertical",
          part: "grid-line",
        })}
        style={
          orientation === "vertical"
            ? { left: `${position}%` }
            : { top: `${position}%` }
        }
        {...props}
      />
    );
  }

  export interface CrosshairProps extends React.ComponentProps<"div"> {
    orientation: "vertical" | "horizontal";
  }

  export function Crosshair({
    className,
    orientation,
    ...props
  }: CrosshairProps) {
    const { thumbX, thumbY } = useContext();
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", {
          "crosshair-horizontal": orientation === "horizontal",
          "crosshair-vertical": orientation === "vertical",
          part: "crosshair",
        })}
        style={
          orientation === "vertical"
            ? { left: `${thumbX}%` }
            : { top: `${thumbY}%` }
        }
        {...props}
      />
    );
  }

  export interface CursorProps extends React.ComponentProps<"div"> {}

  export function Cursor({ className, ...props }: CursorProps) {
    const { thumbX, thumbY } = useContext();
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor" })}
        style={{
          left: `${thumbX}%`,
          top: `${thumbY}%`,
        }}
        {...props}
      />
    );
  }

  export interface CursorGlowProps extends React.ComponentProps<"div"> {}

  export function CursorGlow({ className, ...props }: CursorGlowProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor-glow" })}
        {...props}
      />
    );
  }

  export interface CursorDotProps extends React.ComponentProps<"div"> {}

  export function CursorDot({ className, ...props }: CursorDotProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor-dot" })}
        {...props}
      />
    );
  }

  export interface CursorHighlightProps extends React.ComponentProps<"div"> {}

  export function CursorHighlight({
    className,
    ...props
  }: CursorHighlightProps) {
    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("xypad", { part: "cursor-highlight" })}
        {...props}
      />
    );
  }

  export interface ValueDisplayProps
    extends Omit<React.ComponentProps<"div">, "children"> {
    formatValue?: (value: Point) => React.ReactNode;
  }

  export function ValueDisplay({
    className,
    formatValue,
    ...props
  }: ValueDisplayProps) {
    const { value } = useContext();

    const content = formatValue ? (
      formatValue(value)
    ) : (
      <>
        <span {...getDataAttributes("xypad", { part: "value-x" })}>
          {value.x.toFixed(0)}
        </span>
        <span {...getDataAttributes("xypad", { part: "value-separator" })}>
          ,{" "}
        </span>
        <span {...getDataAttributes("xypad", { part: "value-y" })}>
          {value.y.toFixed(0)}
        </span>
      </>
    );

    return (
      <div
        aria-live="polite"
        className={className}
        {...getDataAttributes("xypad", { part: "value-display" })}
        {...props}
      >
        {content}
      </div>
    );
  }

  export interface LabelProps extends React.ComponentProps<"span"> {}

  export function Label({ className, ...props }: LabelProps) {
    const { elementId, value } = useContext();
    return (
      <span
        aria-live="polite"
        className={className}
        id={`${elementId}-label`}
        role="status"
        style={{
          border: 0,
          clip: "rect(0, 0, 0, 0)",
          height: 1,
          margin: -1,
          overflow: "hidden",
          padding: 0,
          position: "absolute",
          whiteSpace: "nowrap",
          width: 1,
        }}
        {...props}
      >
        {`X: ${value.x.toFixed(1)}, Y: ${value.y.toFixed(1)}`}
      </span>
    );
  }
}
