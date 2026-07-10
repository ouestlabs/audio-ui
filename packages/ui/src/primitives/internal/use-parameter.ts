import type { Nullable, Point, Procedure } from "@audio-ui/utils";
import { clamp, clampUnit, quantizeRound } from "@audio-ui/utils";
import * as React from "react";
import { useKeyboardNavigation } from "../../hooks/interactions/use-keyboard-navigation";
import { useWheel } from "../../hooks/interactions/use-wheel";
import { useControlledValue } from "../../hooks/state/use-controlled-value";
import { useValueAsRef } from "../../hooks/state/use-value-as-ref";

const PAGE_STEP_MULTIPLIER = 10;
const WHEEL_DELTA_EPSILON = 0.1;

export interface UseParameterOptions {
  /**
   * Arms the outside-click commit: while a drag is active, a pointerdown whose
   * target this predicate rejects commits the pending value.
   */
  containsTarget?: (target: Node) => boolean;
  defaultValue?: number;
  /** Maps a pointer delta to the next value. Required by the assembled drag callbacks. */
  deltaToValue?: (delta: Point, startValue: number) => number;
  disabled?: boolean;
  /** Element focused when a drag begins. */
  focusRef?: React.RefObject<Nullable<HTMLElement>>;
  /**
   * While dragging, expose the dragged value as `displayValue` even when the
   * controlled value lags behind (externally driven controls such as seek bars).
   */
  freezeWhileDragging?: boolean;
  max: number;
  min: number;
  onValueChange?: Procedure<number>;
  onValueCommit?: Procedure<number>;
  /** Maps a viewport point to a value; return null when geometry cannot answer. */
  pointToValue?: (point: Point) => Nullable<number>;
  step: number;
  value?: number;
}

export interface UseParameterDragCallbacks {
  onDrag: (delta: Point) => void;
  onDragEnd: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

export interface UseParameterReturn {
  /** Granular op: mark a drag active and seed the start/pending refs. */
  beginDrag: (startValue: number) => void;
  commitValue: (next: number) => void;
  /** Optimistic-aware value for rendering position; equals `value` unless frozen mid-drag. */
  displayValue: number;
  /** Assembled drag lifecycle for the standard point/delta geometry. */
  dragCallbacks: UseParameterDragCallbacks;
  dragStartValueRef: React.RefObject<number>;
  /** Granular op: stream a mid-drag value (pending + update). */
  dragTo: (next: number) => void;
  /** Granular op: end the drag and commit `finalValue` (default: the pending value). */
  endDrag: (finalValue?: number) => void;
  isDragActiveRef: React.RefObject<boolean>;
  isDragging: boolean;
  keyboardProps: { onKeyDown: Procedure<React.KeyboardEvent> };
  pendingValueRef: React.RefObject<number>;
  percentage: number;
  setRawValue: Procedure<number>;
  shouldPreventFocusRef: React.RefObject<boolean>;
  updateValue: (next: number) => void;
  /** The raw (controlled or internal) value; use for aria attributes. */
  value: number;
  valueRef: React.RefObject<number>;
  wheelRef: (node: Nullable<HTMLElement>) => void;
}

/**
 * A parameter: a bounded, stepped, continuously controllable value.
 * Owns the controlled-value wiring, clamp/step math, commit semantics, and the
 * keyboard/wheel/drag lifecycle shared by the 1D primitives. Geometry
 * (point→value, delta→value) is injected; primitives with non-linear gestures
 * (Knob) skip the assembled `dragCallbacks` and compose the granular ops.
 */
export function useParameter({
  containsTarget,
  defaultValue,
  deltaToValue,
  disabled = false,
  focusRef,
  freezeWhileDragging = false,
  max,
  min,
  onValueChange,
  onValueCommit,
  pointToValue,
  step,
  value: controlledValue,
}: UseParameterOptions): UseParameterReturn {
  const computedDefaultValue =
    defaultValue ?? (max < min ? min : min + (max - min) / 2);

  const transformValue = React.useCallback(
    (val: number) => {
      const numValue = Number(val);
      if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
        return min;
      }
      return clamp(numValue, min, max);
    },
    [min, max]
  );

  const { value: rawValue, setValue: setRawValue } = useControlledValue<number>(
    {
      defaultValue: computedDefaultValue,
      onChange: onValueChange,
      transform: transformValue,
      value: controlledValue,
    }
  );

  const value = rawValue ?? min;
  const valueRef = useValueAsRef(value);

  const [isDragging, setIsDragging] = React.useState(false);
  const [optimisticValue, setOptimisticValue] =
    React.useState<Nullable<number>>(null);

  const clampStep = React.useCallback(
    (next: number) => quantizeRound(clamp(next, min, max), step),
    [min, max, step]
  );

  const updateValue = React.useCallback(
    (next: number) => {
      const steppedValue = clampStep(next);
      if (freezeWhileDragging) {
        setOptimisticValue(steppedValue);
      }
      setRawValue(steppedValue);
    },
    [clampStep, freezeWhileDragging, setRawValue]
  );

  const commitValue = React.useCallback(
    (next: number) => {
      const steppedValue = clampStep(next);
      setRawValue(steppedValue);
      onValueCommit?.(steppedValue);
    },
    [clampStep, setRawValue, onValueCommit]
  );

  const dragStartValueRef = React.useRef(value);
  const isDragActiveRef = React.useRef(false);
  const pendingValueRef = React.useRef(value);
  const shouldPreventFocusRef = React.useRef(false);

  const beginDrag = React.useCallback((startValue: number) => {
    isDragActiveRef.current = true;
    setIsDragging(true);
    dragStartValueRef.current = startValue;
    pendingValueRef.current = startValue;
  }, []);

  const dragTo = React.useCallback(
    (next: number) => {
      pendingValueRef.current = next;
      updateValue(next);
    },
    [updateValue]
  );

  const endDrag = React.useCallback(
    (finalValue?: number) => {
      isDragActiveRef.current = false;
      setIsDragging(false);
      setOptimisticValue(null);
      commitValue(finalValue ?? pendingValueRef.current);
    },
    [commitValue]
  );

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      shouldPreventFocusRef.current = true;
      e.preventDefault();
      if (focusRef?.current && !disabled) {
        focusRef.current.focus();
      }
    },
    [disabled, focusRef]
  );

  const onDragStart = React.useCallback(
    (e: React.PointerEvent) => {
      const next =
        pointToValue?.({ x: e.clientX, y: e.clientY }) ?? valueRef.current;
      beginDrag(next);
      updateValue(next);
    },
    [beginDrag, pointToValue, updateValue, valueRef]
  );

  const onDrag = React.useCallback(
    (delta: Point) => {
      if (!deltaToValue) {
        return;
      }
      dragTo(deltaToValue(delta, dragStartValueRef.current));
    },
    [deltaToValue, dragTo]
  );

  const onDragEnd = React.useCallback(() => {
    endDrag();
  }, [endDrag]);

  const dragCallbacks = React.useMemo<UseParameterDragCallbacks>(
    () => ({ onDrag, onDragEnd, onDragStart, onPointerDown }),
    [onDrag, onDragEnd, onDragStart, onPointerDown]
  );

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
        commitValue(valueRef.current - step * PAGE_STEP_MULTIPLIER);
        return true;
      },
      onPageUp: () => {
        commitValue(valueRef.current + step * PAGE_STEP_MULTIPLIER);
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
      commitValue(valueRef.current + direction * step);
    },
  });

  React.useEffect(() => {
    if (!isDragActiveRef.current) {
      dragStartValueRef.current = value;
      pendingValueRef.current = value;
    }
  }, [value]);

  React.useEffect(() => {
    if (!(isDragging && containsTarget)) {
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
      if (!containsTarget(target) && isDragActiveRef.current) {
        isDragActiveRef.current = false;
        commitValue(pendingValueRef.current);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, {
      capture: true,
      signal,
    });

    return () => {
      abortController.abort();
    };
  }, [isDragging, containsTarget, commitValue]);

  const displayValue =
    freezeWhileDragging && optimisticValue !== null ? optimisticValue : value;
  const percentage = clampUnit((displayValue - min) / (max - min || 1));

  return {
    beginDrag,
    commitValue,
    displayValue,
    dragCallbacks,
    dragStartValueRef,
    dragTo,
    endDrag,
    isDragActiveRef,
    isDragging,
    keyboardProps,
    pendingValueRef,
    percentage,
    setRawValue,
    shouldPreventFocusRef,
    updateValue,
    value,
    valueRef,
    wheelRef,
  };
}
