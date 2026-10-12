import type { ParameterScale } from "../../value/scale";

/** One of the plot's two axes: its range and how values spread along it. */
export interface PlotAxis {
  max: number;
  min: number;
  scale: ParameterScale;
}

/** Where `value` sits along `axis`, 0 at its `min` to 1 at its `max`. */
export function positionOn(axis: PlotAxis, value: number): number {
  return axis.scale.toPosition(value, axis.min, axis.max);
}

/** The value at `position` (0…1) along `axis`. */
export function valueOn(axis: PlotAxis, position: number): number {
  return axis.scale.toValue(position, axis.min, axis.max);
}
