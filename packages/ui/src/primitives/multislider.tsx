import type { Nullable, Point, Procedure } from "@audio-ui/utils";
import {
  clamp,
  clampUnit,
  linear,
  panic,
  quantizeRound,
} from "@audio-ui/utils";
import * as React from "react";
import { useFocus } from "../hooks/interactions/use-focus";
import { useKeyboardNavigation } from "../hooks/interactions/use-keyboard-navigation";
import { usePointerDrag } from "../hooks/interactions/use-pointer-drag";
import { useWheel } from "../hooks/interactions/use-wheel";
import { getDataAttributes } from "./internal/data-attributes";
import { useInheritedOrientation } from "./internal/orientation-context";
import { useParameterCore } from "./internal/use-parameter-core";

const PAGE_STEP_MULTIPLIER = 10;
const WHEEL_DELTA_EPSILON = 0.1;
const DEFAULT_VALUE: number[] = [0.5, 0.5, 0.5, 0.5];

/** A pointer sample mapped into slider space: which column, and the 0-1 value along the value axis. */
interface PaintPosition {
  index: number;
  normalized: number;
}

export namespace Multislider {
  interface ConfigContextValue {
    adjustSlider: (index: number, amount: number) => void;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    disabled: boolean;
    dragHandlers: {
      onDrag: (e: React.PointerEvent, delta: Point) => void;
      onDragCancel: Procedure<React.PointerEvent>;
      onDragEnd: Procedure<React.PointerEvent>;
      onDragStart: Procedure<React.PointerEvent>;
    };
    elementId: string;
    focusSlider: (index: number) => void;
    max: number;
    min: number;
    orientation: "horizontal" | "vertical";
    registerSlider: (index: number, node: Nullable<HTMLElement>) => void;
    setFocusedIndex: Procedure<number>;
    setSlider: (index: number, value: number) => void;
    shouldPreventFocusRef: React.RefObject<boolean>;
    step: number;
    trackRef: React.RefObject<Nullable<HTMLDivElement>>;
  }

  /** Split from config: changes every paint frame, so only components that render live values subscribe to it. */
  interface ValueContextValue {
    focusedIndex: number;
    values: number[];
  }

  const ConfigContext = React.createContext<ConfigContextValue | null>(null);
  const ValueContext = React.createContext<ValueContextValue | null>(null);
  const SliderIndexContext = React.createContext<Nullable<number>>(null);

  function useConfigContext() {
    const context = React.useContext(ConfigContext);
    if (!context) {
      panic("Multislider components must be used within Multislider.Root");
    }
    return context;
  }

  function useValueContext() {
    const context = React.useContext(ValueContext);
    if (!context) {
      panic("Multislider components must be used within Multislider.Root");
    }
    return context;
  }

  function useSliderIndex() {
    const index = React.useContext(SliderIndexContext);
    if (index === null) {
      panic("Multislider slider parts must be used within Multislider.Slider");
    }
    return index;
  }

  export interface RootProps
    extends Omit<
      React.ComponentProps<"div">,
      "onChange" | "onInput" | "type" | "value" | "defaultValue"
    > {
    "aria-label"?: string;
    "aria-labelledby"?: string;
    defaultValue?: number[];
    disabled?: boolean;
    max?: number;
    min?: number;
    onValueChange?: Procedure<number[]>;
    onValueCommit?: Procedure<number[]>;
    orientation?: "horizontal" | "vertical";
    step?: number;
    value?: number[];
  }

  export function Root({
    value: controlledValue,
    defaultValue = DEFAULT_VALUE,
    min = 0,
    max = 1,
    step = 0.01,
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

    const multisliderId = React.useId();
    const trackRef = React.useRef<HTMLDivElement>(null);
    const sliderElementsRef = React.useRef(new Map<number, HTMLElement>());
    const lastPaintRef = React.useRef<Nullable<PaintPosition>>(null);
    const [focusedIndex, setFocusedIndex] = React.useState(0);

    const transformValue = React.useCallback(
      (vals: number[]) =>
        vals.map((val) => {
          const num = Number(val);
          return Number.isNaN(num) || !Number.isFinite(num)
            ? min
            : clamp(num, min, max);
        }),
      [min, max]
    );

    const clampStep = React.useCallback(
      (next: number[]) =>
        next.map((val) => quantizeRound(clamp(val, min, max), step)),
      [min, max, step]
    );

    const containsTarget = React.useCallback(
      (target: Node) => Boolean(trackRef.current?.contains(target)),
      []
    );

    const {
      beginDrag,
      commitValue,
      dragTo,
      endDrag,
      pendingValueRef,
      shouldPreventFocusRef,
      updateValue,
      value: values,
      valueRef,
    } = useParameterCore<number[]>({
      clampStep,
      containsTarget,
      defaultValue,
      disabled,
      fallbackValue: defaultValue,
      onValueChange,
      onValueCommit,
      transform: transformValue,
      value: controlledValue,
    });

    const getPaintPosition = React.useCallback(
      (client: Point): Nullable<PaintPosition> => {
        const track = trackRef.current;
        if (!track) {
          return null;
        }

        const rect = track.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return null;
        }

        const count = valueRef.current.length;
        if (count === 0) {
          return null;
        }

        if (orientation === "vertical") {
          const columnFraction = clampUnit((client.x - rect.left) / rect.width);
          return {
            index: Math.min(Math.floor(columnFraction * count), count - 1),
            normalized: 1 - clampUnit((client.y - rect.top) / rect.height),
          };
        }

        const rowFraction = clampUnit((client.y - rect.top) / rect.height);
        return {
          index: Math.min(Math.floor(rowFraction * count), count - 1),
          normalized: clampUnit((client.x - rect.left) / rect.width),
        };
      },
      [orientation, valueRef]
    );

    /**
     * Paints `position` into `base`, filling every slider crossed since the
     * previous sample (linear interpolation) so fast swipes skip no column.
     */
    const paintTo = React.useCallback(
      (position: PaintPosition, base: number[]) => {
        const next = [...base];
        const last = lastPaintRef.current ?? position;
        const span = position.index - last.index;

        if (span === 0) {
          next[position.index] = min + position.normalized * (max - min);
        } else {
          const direction = span > 0 ? 1 : -1;
          for (
            let i = last.index;
            i !== position.index + direction;
            i += direction
          ) {
            const t = (i - last.index) / span;
            next[i] =
              min +
              linear(last.normalized, position.normalized, t) * (max - min);
          }
        }

        lastPaintRef.current = position;
        return next;
      },
      [min, max]
    );

    const handleDragStart = React.useCallback(
      (e: React.PointerEvent) => {
        const position = getPaintPosition({ x: e.clientX, y: e.clientY });
        if (!position) {
          beginDrag(valueRef.current);
          return;
        }

        shouldPreventFocusRef.current = true;
        setFocusedIndex(position.index);
        sliderElementsRef.current.get(position.index)?.focus();

        lastPaintRef.current = null;
        const next = paintTo(position, valueRef.current);
        beginDrag(next);
        updateValue(next);
      },
      [
        beginDrag,
        getPaintPosition,
        paintTo,
        shouldPreventFocusRef,
        updateValue,
        valueRef,
      ]
    );

    const handleDrag = React.useCallback(
      (e: React.PointerEvent, _delta: Point) => {
        const position = getPaintPosition({ x: e.clientX, y: e.clientY });
        if (!position) {
          return;
        }
        dragTo(paintTo(position, pendingValueRef.current));
      },
      [dragTo, getPaintPosition, paintTo, pendingValueRef]
    );

    const handleDragEnd = React.useCallback(() => {
      lastPaintRef.current = null;
      endDrag();
    }, [endDrag]);

    const dragHandlers = React.useMemo(
      () => ({
        onDrag: handleDrag,
        onDragCancel: handleDragEnd,
        onDragEnd: handleDragEnd,
        onDragStart: handleDragStart,
      }),
      [handleDrag, handleDragEnd, handleDragStart]
    );

    const setSlider = React.useCallback(
      (index: number, nextValue: number) => {
        if (index < 0 || index >= valueRef.current.length) {
          return;
        }
        const next = [...valueRef.current];
        next[index] = nextValue;
        commitValue(next);
      },
      [commitValue, valueRef]
    );

    const adjustSlider = React.useCallback(
      (index: number, amount: number) => {
        const current = valueRef.current[index];
        if (current === undefined) {
          return;
        }
        setSlider(index, current + amount);
      },
      [setSlider, valueRef]
    );

    const focusSlider = React.useCallback(
      (index: number) => {
        const count = valueRef.current.length;
        if (count === 0) {
          return;
        }
        const next = clamp(index, 0, count - 1);
        setFocusedIndex(next);
        sliderElementsRef.current.get(next)?.focus();
      },
      [valueRef]
    );

    const registerSlider = React.useCallback(
      (index: number, node: Nullable<HTMLElement>) => {
        if (node) {
          sliderElementsRef.current.set(index, node);
        } else {
          sliderElementsRef.current.delete(index);
        }
      },
      []
    );

    const elementId = id || multisliderId;

    const configValue = React.useMemo<ConfigContextValue>(
      () => ({
        adjustSlider,
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragHandlers,
        elementId,
        focusSlider,
        max,
        min,
        orientation,
        registerSlider,
        setFocusedIndex,
        setSlider,
        shouldPreventFocusRef,
        step,
        trackRef,
      }),
      [
        adjustSlider,
        ariaLabel,
        ariaLabelledBy,
        disabled,
        dragHandlers,
        elementId,
        focusSlider,
        max,
        min,
        orientation,
        registerSlider,
        setSlider,
        shouldPreventFocusRef,
        step,
      ]
    );

    const valueContextValue = React.useMemo<ValueContextValue>(
      () => ({ focusedIndex, values }),
      [focusedIndex, values]
    );

    return (
      <ConfigContext.Provider value={configValue}>
        <ValueContext.Provider value={valueContextValue}>
          <div
            className={className}
            {...getDataAttributes("multislider", {
              part: "multislider-wrapper",
            })}
            {...props}
          >
            {ariaLabel || ariaLabelledBy ? null : (
              <span className="sr-only" id={`${elementId}-label`}>
                Multislider
              </span>
            )}
            <span className="sr-only" id={`${elementId}-instructions`}>
              Use arrow keys to move between sliders and adjust values.
            </span>
            {children}
          </div>
        </ValueContext.Provider>
      </ConfigContext.Provider>
    );
  }

  export interface TrackProps extends React.ComponentProps<"div"> {}

  export function Track({ className, ...props }: TrackProps) {
    const {
      ariaLabel,
      ariaLabelledBy,
      disabled,
      dragHandlers,
      elementId,
      orientation,
      trackRef,
    } = useConfigContext();

    const { pointerProps } = usePointerDrag({
      capturePointer: true,
      disabled,
      elementRef: trackRef,
      releaseOnOutsideClick: true,
      ...dragHandlers,
    });

    return (
      <div
        aria-label={ariaLabel || "Multislider"}
        aria-labelledby={
          ariaLabelledBy || (ariaLabel ? undefined : `${elementId}-label`)
        }
        className={className}
        {...getDataAttributes("multislider", { disabled, orientation })}
        ref={trackRef}
        role="group"
        {...pointerProps}
        {...props}
      />
    );
  }

  export interface SlidersProps {
    children: (value: number, index: number) => React.ReactNode;
  }

  export function Sliders({ children }: SlidersProps) {
    const { values } = useValueContext();
    return <>{values.map((value, index) => children(value, index))}</>;
  }

  export interface SliderProps extends React.ComponentProps<"div"> {
    index: number;
  }

  export function Slider({
    index,
    className,
    children,
    "aria-describedby": ariaDescribedBy,
    ...props
  }: SliderProps) {
    const {
      adjustSlider,
      disabled,
      elementId,
      focusSlider,
      max,
      min,
      orientation,
      registerSlider,
      setFocusedIndex,
      setSlider,
      shouldPreventFocusRef,
      step,
    } = useConfigContext();
    const { focusedIndex, values } = useValueContext();

    const count = values.length;
    const value = values[index] ?? min;
    const isVertical = orientation === "vertical";
    const isFocusTarget = index === Math.min(focusedIndex, count - 1);

    const { keyboardProps } = useKeyboardNavigation({
      disabled,
      handlers: {
        onArrowDown: () => {
          if (isVertical) {
            adjustSlider(index, -step);
          } else {
            focusSlider(index + 1);
          }
          return true;
        },
        onArrowLeft: () => {
          if (isVertical) {
            focusSlider(index - 1);
          } else {
            adjustSlider(index, -step);
          }
          return true;
        },
        onArrowRight: () => {
          if (isVertical) {
            focusSlider(index + 1);
          } else {
            adjustSlider(index, step);
          }
          return true;
        },
        onArrowUp: () => {
          if (isVertical) {
            adjustSlider(index, step);
          } else {
            focusSlider(index - 1);
          }
          return true;
        },
        onEnd: () => {
          setSlider(index, max);
          return true;
        },
        onHome: () => {
          setSlider(index, min);
          return true;
        },
        onPageDown: () => {
          adjustSlider(index, -step * PAGE_STEP_MULTIPLIER);
          return true;
        },
        onPageUp: () => {
          adjustSlider(index, step * PAGE_STEP_MULTIPLIER);
          return true;
        },
      },
    });

    const { wheelRef } = useWheel({
      disabled,
      onWheel: (delta: Point) => {
        if (Math.abs(delta.y) < WHEEL_DELTA_EPSILON) {
          return;
        }
        const direction = delta.y < 0 ? 1 : -1;
        adjustSlider(index, direction * step);
      },
    });

    const { focusProps } = useFocus({
      disabled,
      onFocus: () => {
        if (shouldPreventFocusRef.current) {
          shouldPreventFocusRef.current = false;
        }
        setFocusedIndex(index);
      },
    });

    const sliderRef = React.useCallback(
      (node: Nullable<HTMLElement>) => {
        registerSlider(index, node);
        wheelRef(node);
      },
      [index, registerSlider, wheelRef]
    );

    return (
      <SliderIndexContext.Provider value={index}>
        <div
          aria-describedby={ariaDescribedBy || `${elementId}-instructions`}
          aria-disabled={disabled}
          aria-label={`Slider ${index + 1} of ${count}`}
          aria-orientation={orientation}
          aria-valuemax={max}
          aria-valuemin={min}
          aria-valuenow={value}
          className={className}
          {...getDataAttributes("multislider", {
            disabled,
            orientation,
            part: "slider",
          })}
          ref={sliderRef}
          role="slider"
          {...keyboardProps}
          {...focusProps}
          tabIndex={disabled || !isFocusTarget ? -1 : 0}
          {...props}
        >
          {children}
        </div>
      </SliderIndexContext.Provider>
    );
  }

  export interface FillProps extends React.ComponentProps<"div"> {}

  export function Fill({ className, style, ...props }: FillProps) {
    const { max, min, orientation } = useConfigContext();
    const { values } = useValueContext();
    const index = useSliderIndex();
    const percentage = clampUnit(
      ((values[index] ?? min) - min) / (max - min || 1)
    );

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("multislider", { orientation, part: "fill" })}
        style={{
          ...(orientation === "horizontal"
            ? {
                height: "100%",
                transform: `scaleX(${percentage})`,
                transformOrigin: "left center",
                width: "100%",
                willChange: "transform",
              }
            : {
                height: "100%",
                transform: `scaleY(${percentage})`,
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
    const { max, min, orientation } = useConfigContext();
    const { values } = useValueContext();
    const index = useSliderIndex();
    const percentage = clampUnit(
      ((values[index] ?? min) - min) / (max - min || 1)
    );

    const baseTransform =
      orientation === "horizontal" ? "translateX(-50%)" : "translateY(50%)";
    const transform = style?.transform
      ? `${baseTransform} ${style.transform}`
      : baseTransform;

    return (
      <div
        aria-hidden="true"
        className={className}
        {...getDataAttributes("multislider", { orientation, part: "thumb" })}
        style={{
          ...(orientation === "horizontal"
            ? { left: `${percentage * 100}%` }
            : { bottom: `${percentage * 100}%` }),
          ...style,
          transform,
        }}
        {...props}
      />
    );
  }
}
