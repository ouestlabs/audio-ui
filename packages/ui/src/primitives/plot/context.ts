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
