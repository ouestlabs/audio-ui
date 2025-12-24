import {
  clamp,
  degToRad,
  type Nullable,
  Point,
  type Procedure,
  panic,
  quantizeRound,
  TAU,
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

interface KnobContextValue {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  angleRange: number;
  angleOffset: number;
  percentage: number;
  rotation: number;
  elementId: string;
  knobRef: React.RefObject<Nullable<HTMLDivElement>>;
  updateValue: Procedure<number>;
  commitValue: Procedure<number>;
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
  onDragStart: () => void;
  onDrag: (delta: Point) => void;
  onDragEnd: () => void;
  getArcPath: (start: number, end: number) => string;
}

const KnobContext = React.createContext<KnobContextValue | null>(null);

function useKnobContext() {
  const context = React.useContext(KnobContext);
  if (!context) {
    panic("Knob components must be used within Knob.Root");
  }
  return context;
}

export namespace Knob {
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
    value?: number;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    angleRange?: number;
    angleOffset?: number;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    onValueChange?: Procedure<number>;
    onValueCommit?: Procedure<number>;
  }

  export function Root({
    value: controlledValue,
    defaultValue = 0,
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    angleRange = 270,
    angleOffset = -135,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    onValueChange,
    onValueCommit,
    id,
    className,
    children,
    ...props
  }: RootProps) {
    const knobId = React.useId();
    const knobRef = React.useRef<HTMLDivElement>(null);

    const computedDefaultValue =
      defaultValue ?? (max < min ? min : min + (max - min) / 2);

    const { value: rawValue, setValue: setRawValue } =
      useControlledValue<number>({
        value: controlledValue,
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

    const dragStartValueRef = React.useRef(value);
    const isDragActiveRef = React.useRef(false);
    const pendingValueRef = React.useRef(value);
    const shouldPreventFocusRef = React.useRef(false);

    const onPointerDown = React.useCallback(
      (e: React.PointerEvent) => {
        shouldPreventFocusRef.current = true;
        e.preventDefault();
        if (knobRef.current && !disabled) {
          knobRef.current.focus();
        }
      },
      [disabled]
    );

    const calculateValueFromDelta = React.useCallback(
      (delta: Point, initialValue: number) => {
        const sensitivity = (max - min) / 150;
        return initialValue + delta.y * sensitivity;
      },
      [min, max]
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

    const onDragStart = React.useCallback(() => {
      isDragActiveRef.current = true;
      dragStartValueRef.current = valueRef.current;
      pendingValueRef.current = valueRef.current;
    }, [valueRef]);

    const onDragEnd = React.useCallback(() => {
      isDragActiveRef.current = false;
      commitValue(pendingValueRef.current);
    }, [commitValue]);

    const { wheelRef } = useWheel({
      disabled,
      elementRef: knobRef,
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
    const rotation = angleOffset + percentage * angleRange;
    const elementId = id || knobId;

    const getArcPath = (start: number, end: number) => {
      const center = Point.create(24, 24);
      const innerRadius = 20;
      const outerRadius = 23;
      const innerStart = Point.create(
        center.x + innerRadius * Math.cos(start),
        center.y + innerRadius * Math.sin(start)
      );
      const innerEnd = Point.create(
        center.x + innerRadius * Math.cos(end),
        center.y + innerRadius * Math.sin(end)
      );
      const outerStart = Point.create(
        center.x + outerRadius * Math.cos(start),
        center.y + outerRadius * Math.sin(start)
      );
      const outerEnd = Point.create(
        center.x + outerRadius * Math.cos(end),
        center.y + outerRadius * Math.sin(end)
      );
      const largeArcFlag = Math.abs(end - start) > TAU / 2 ? 1 : 0;
      return `M ${innerStart.x} ${innerStart.y} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y} L ${outerEnd.x} ${outerEnd.y} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerStart.x} ${outerStart.y} Z`;
    };

    const contextValue: KnobContextValue = {
      value,
      min,
      max,
      step,
      disabled,
      angleRange,
      angleOffset,
      percentage,
      rotation,
      elementId,
      knobRef,
      updateValue,
      commitValue,
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
      getArcPath,
    };

    return (
      <KnobContext.Provider value={contextValue}>
        <div
          className={className}
          {...getDataAttributes("knob", { part: "wrapper" })}
          {...props}
        >
          {children}
        </div>
      </KnobContext.Provider>
    );
  }

  export interface SliderProps extends React.ComponentProps<"div"> {}

  export function Slider({ className, ...props }: SliderProps) {
    const {
      disabled,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      min,
      max,
      value,
      knobRef,
      wheelRef,
      focusProps,
      keyboardProps,
      pointerProps,
      shouldPreventFocusRef,
    } = useKnobSlider();

    return (
      <div
        aria-disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className={className}
        {...getDataAttributes("knob", { disabled })}
        ref={(node) => {
          knobRef.current = node;
          wheelRef(node);
        }}
        role="slider"
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

  export interface ArcProps extends React.ComponentProps<"svg"> {}

  export function Arc({ className, ...props }: ArcProps) {
    const { getArcPath, angleOffset, percentage, angleRange } =
      useKnobContext();

    const svgStartAngle = degToRad(angleOffset - 90);
    const svgEndAngle = degToRad(angleOffset + percentage * angleRange - 90);

    return (
      <svg
        className={className}
        {...getDataAttributes("knob", { part: "arc" })}
        viewBox="0 0 48 48"
        {...props}
      >
        <title>Knob arc</title>
        <path d={getArcPath(svgStartAngle, svgEndAngle)} />
      </svg>
    );
  }

  export interface BodyProps extends React.ComponentProps<"div"> {}

  export function Body({ className, ...props }: BodyProps) {
    const { rotation } = useKnobContext();
    return (
      <div
        className={className}
        {...getDataAttributes("knob", { part: "body" })}
        style={{ transform: `rotate(${rotation}deg)` }}
        {...props}
      />
    );
  }

  export interface IndicatorProps extends React.ComponentProps<"div"> {}

  export function Indicator({ className, ...props }: IndicatorProps) {
    return (
      <div
        className={className}
        {...getDataAttributes("knob", { part: "indicator" })}
        {...props}
      />
    );
  }

  function useKnobSlider() {
    const {
      disabled,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      min,
      max,
      value,
      knobRef,
      wheelRef,
      onPointerDown,
      onDragStart,
      onDrag,
      onDragEnd,
      shouldPreventFocusRef,
      valueRef,
      step,
      commitValue,
    } = useKnobContext();

    const { pointerProps } = usePointerDrag({
      disabled,
      elementRef: knobRef,
      capturePointer: true,
      releaseOnOutsideClick: true,
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

    return {
      disabled,
      elementId,
      ariaLabel,
      ariaLabelledBy,
      min,
      max,
      value,
      knobRef,
      wheelRef,
      focusProps,
      keyboardProps,
      pointerProps,
      shouldPreventFocusRef,
    };
  }
}
