import type { ParameterScale } from "@audio-ui/core";
import * as React from "react";

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
    /**
     * The plot's box in the viewport. Reading it forces the browser to lay the
     * page out, which it would otherwise do once per frame at most, so the
     * box is kept until the plot is resized or the page scrolls; `fresh` reads
     * it again, for the start of a gesture.
     */
    measure: (fresh?: boolean) => DOMRect | null;
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
  const { measure, x, y } = meta;
  return React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = measure();
      if (!rect) {
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
    [measure, x, y]
  );
}
