import type { Nullable, Point, Procedure } from "@audio-ui/utils";
import { clamp, clampUnit, quantizeRound } from "@audio-ui/utils";
import * as React from "react";
import { useKeyboardNavigation } from "../../hooks/interactions/use-keyboard-navigation";
import { useWheel } from "../../hooks/interactions/use-wheel";
import type { UseParameterCoreDragCallbacks } from "./use-parameter-core";
import { useParameterCore } from "./use-parameter-core";

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

export type UseParameterDragCallbacks = UseParameterCoreDragCallbacks;

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
 * The number instantiation of `useParameterCore` — adds the 1D policies:
 * midpoint default, NaN→min coercion, the 8-key keyboard map, ±step wheel,
 * and the guarded percentage. Geometry (point→value, delta→value) is
 * injected; primitives with non-linear gestures (Knob) skip the assembled
 * `dragCallbacks` and compose the granular ops.
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

  const clampStep = React.useCallback(
    (next: number) => quantizeRound(clamp(next, min, max), step),
    [min, max, step]
  );

  const core = useParameterCore<number>({
    clampStep,
    containsTarget,
    defaultValue: computedDefaultValue,
    deltaToValue,
    disabled,
    fallbackValue: min,
    focusRef,
    freezeWhileDragging,
    onValueChange,
    onValueCommit,
    pointToValue,
    transform: transformValue,
    value: controlledValue,
  });

  const { commitValue, valueRef } = core;

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

  const percentage = clampUnit((core.displayValue - min) / (max - min || 1));

  return {
    ...core,
    keyboardProps,
    percentage,
    wheelRef,
  };
}
