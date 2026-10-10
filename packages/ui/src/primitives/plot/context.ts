import * as React from "react";
import type { ParameterScale } from "../internal/parameter-scale";

export type PlotState = {
  disabled: boolean;
};

/** One of the plot's two axes: its range and how values spread along it. */
export interface PlotAxis {
  max: number;
  min: number;
  scale: ParameterScale;
}

export interface PlotContextValue {
  meta: {
    /** The plot's element: what pointer moves are measured against. */
    elementRef: React.RefObject<HTMLElement | null>;
    x: PlotAxis;
    y: PlotAxis;
  };
  state: PlotState;
}

export const PlotContext = React.createContext<PlotContextValue | null>(null);

export function usePlotContext(part: string): PlotContextValue {
  const context = React.use(PlotContext);
  if (!context) {
    throw new Error(`Plot.${part} must be used within Plot.Root`);
  }
  return context;
}

/** Where `value` sits along `axis`, 0 at its `min` to 1 at its `max`. */
export function positionOn(axis: PlotAxis, value: number): number {
  return axis.scale.toPosition(value, axis.min, axis.max);
}

/** The value at `position` (0…1) along `axis`. */
export function valueOn(axis: PlotAxis, position: number): number {
  return axis.scale.toValue(position, axis.min, axis.max);
}

/**
 * Turns a pointer position into a value on the plot: for adding a point where
 * someone double-clicks, or reading out what is under the cursor. Returns a
 * function from `clientX` / `clientY` to `{ x, y }` in the axes' units, or
 * `null` while the plot has no size.
 */
export function useValueAtPointer(): (
  clientX: number,
  clientY: number
) => { x: number; y: number } | null {
  const { meta } = usePlotContext("useValueAtPointer");
  const { elementRef, x, y } = meta;
  return React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = elementRef.current?.getBoundingClientRect();
      if (!(rect && rect.width > 0 && rect.height > 0)) {
        return null;
      }
      const across = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width)
      );
      const up = Math.min(
        1,
        Math.max(0, 1 - (clientY - rect.top) / rect.height)
      );
      return { x: valueOn(x, across), y: valueOn(y, up) };
    },
    [elementRef, x, y]
  );
}
