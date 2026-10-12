import { type PlotAxis, positionOn, valueOn } from "./axis";

/**
 * An SVG path drawing `y = fn(x)` across the whole x axis, in a 1 × 1 box
 * with y going up. Samples are spread evenly along the axis as drawn, so a
 * logarithmic frequency axis gets as many points per octave at the bottom as
 * at the top. With `fillTo`, the path closes down (or up) to that y value,
 * for a filled area.
 */
export function curvePath(
  fn: (x: number) => number,
  x: PlotAxis,
  y: PlotAxis,
  samples: number,
  fillTo?: number
): string {
  const count = Math.max(2, Math.round(samples));
  const points: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = index / (count - 1);
    const value = fn(valueOn(x, along));
    const height = Number.isFinite(value) ? positionOn(y, value) : 0;
    points.push(`${round(along)} ${round(1 - height)}`);
  }
  const path = `M ${points.join(" L ")}`;
  if (fillTo === undefined) {
    return path;
  }
  const base = round(1 - positionOn(y, fillTo));
  return `${path} L 1 ${base} L 0 ${base} Z`;
}

/**
 * An SVG path through `values` spread evenly across the whole x axis, in the
 * same 1 × 1 box with y going up: a spectrum, a level history, anything that
 * arrives as a list. A value that is not a number sits on the floor of the axis.
 * With `fillTo`, the path closes to that y value, for a filled area.
 */
export function tracePath(
  values: ArrayLike<number>,
  y: PlotAxis,
  fillTo?: number
): string {
  if (values.length === 0) {
    return "";
  }
  const last = Math.max(values.length - 1, 1);
  const points: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? Number.NaN;
    const height = Number.isNaN(value) ? 0 : positionOn(y, value);
    points.push(`${round(index / last)} ${round(1 - height)}`);
  }
  const path = `M ${points.join(" L ")}`;
  if (fillTo === undefined) {
    return path;
  }
  const base = round(1 - positionOn(y, fillTo));
  return `${path} L 1 ${base} L 0 ${base} Z`;
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}
