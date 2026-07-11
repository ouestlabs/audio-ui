import type { Nullable, Point, Procedure } from "@audio-ui/utils";
import * as React from "react";
import { useControlledValue } from "../../hooks/state/use-controlled-value";
import { useValueAsRef } from "../../hooks/state/use-value-as-ref";

export interface UseParameterCoreOptions<T> {
  /** Clamp + quantize a candidate value into the parameter's domain. */
  clampStep: (next: T) => T;
  /**
   * Arms the outside-click commit: while a drag is active, a pointerdown whose
   * target this predicate rejects commits the pending value.
   */
  containsTarget?: (target: Node) => boolean;
  /** Already-resolved default (callers own midpoint/zero policies). */
  defaultValue: T;
  /** Maps a pointer delta to the next value. Required by the assembled drag callbacks. */
  deltaToValue?: (delta: Point, startValue: T) => T;
  disabled?: boolean;
  /** Fallback when the controlled value resolves to undefined. */
  fallbackValue: T;
  /** Element focused when a drag begins. */
  focusRef?: React.RefObject<Nullable<HTMLElement>>;
  /**
   * While dragging, expose the dragged value as `displayValue` even when the
   * controlled value lags behind (externally driven controls such as seek bars).
   */
  freezeWhileDragging?: boolean;
  onValueChange?: Procedure<T>;
  onValueCommit?: Procedure<T>;
  /** Maps a viewport point to a value; return null when geometry cannot answer. */
  pointToValue?: (point: Point) => Nullable<T>;
  /** Normalizes incoming (controlled) values — NaN guards, per-axis clamping. */
  transform: (val: T) => T;
  value?: T;
}

export interface UseParameterCoreDragCallbacks {
  onDrag: (delta: Point) => void;
  onDragEnd: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

export interface UseParameterCoreReturn<T> {
  /** Granular op: mark a drag active and seed the start/pending refs. */
  beginDrag: (startValue: T) => void;
  commitValue: (next: T) => void;
  /** Optimistic-aware value for rendering position; equals `value` unless frozen mid-drag. */
  displayValue: T;
  /** Assembled drag lifecycle for the standard point/delta geometry. */
  dragCallbacks: UseParameterCoreDragCallbacks;
  dragStartValueRef: React.RefObject<T>;
  /** Granular op: stream a mid-drag value (pending + update). */
  dragTo: (next: T) => void;
  /** Granular op: end the drag and commit `finalValue` (default: the pending value). */
  endDrag: (finalValue?: T) => void;
  isDragActiveRef: React.RefObject<boolean>;
  isDragging: boolean;
  pendingValueRef: React.RefObject<T>;
  setRawValue: Procedure<T>;
  shouldPreventFocusRef: React.RefObject<boolean>;
  updateValue: (next: T) => void;
  /** The raw (controlled or internal) value; use for aria attributes. */
  value: T;
  valueRef: React.RefObject<T>;
}

/**
 * Value-shape-generic core of a parameter: controlled-value wiring,
 * clamp/step/commit semantics, freeze, and the drag lifecycle. Instantiated
 * by `useParameter` (number) and by XYPad (Point). Keyboard and wheel
 * policies are shape-specific, so they live with the instantiations.
 */
export function useParameterCore<T>({
  clampStep,
  containsTarget,
  defaultValue,
  deltaToValue,
  disabled = false,
  fallbackValue,
  focusRef,
  freezeWhileDragging = false,
  onValueChange,
  onValueCommit,
  pointToValue,
  transform,
  value: controlledValue,
}: UseParameterCoreOptions<T>): UseParameterCoreReturn<T> {
  const { value: rawValue, setValue: setRawValue } = useControlledValue<T>({
    defaultValue,
    onChange: onValueChange,
    transform,
    value: controlledValue,
  });

  const value = rawValue ?? fallbackValue;
  const valueRef = useValueAsRef(value);

  const [isDragging, setIsDragging] = React.useState(false);
  const [optimisticValue, setOptimisticValue] =
    React.useState<Nullable<T>>(null);

  const updateValue = React.useCallback(
    (next: T) => {
      const steppedValue = clampStep(next);
      if (freezeWhileDragging) {
        setOptimisticValue(steppedValue);
      }
      setRawValue(steppedValue);
    },
    [clampStep, freezeWhileDragging, setRawValue]
  );

  const commitValue = React.useCallback(
    (next: T) => {
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

  const beginDrag = React.useCallback((startValue: T) => {
    isDragActiveRef.current = true;
    setIsDragging(true);
    dragStartValueRef.current = startValue;
    pendingValueRef.current = startValue;
  }, []);

  const dragTo = React.useCallback(
    (next: T) => {
      pendingValueRef.current = next;
      updateValue(next);
    },
    [updateValue]
  );

  const endDrag = React.useCallback(
    (finalValue?: T) => {
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

  const dragCallbacks = React.useMemo<UseParameterCoreDragCallbacks>(
    () => ({ onDrag, onDragEnd, onDragStart, onPointerDown }),
    [onDrag, onDragEnd, onDragStart, onPointerDown]
  );

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
      const { target } = e;
      if (!(target instanceof Node)) {
        return;
      }
      if (!containsTarget(target) && isDragActiveRef.current) {
        isDragActiveRef.current = false;
        // Full drag teardown: without clearing the freeze/drag state, a
        // frozen display would stop following external value updates.
        setIsDragging(false);
        setOptimisticValue(null);
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
    pendingValueRef,
    setRawValue,
    shouldPreventFocusRef,
    updateValue,
    value,
    valueRef,
  };
}
