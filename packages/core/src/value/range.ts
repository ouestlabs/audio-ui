import { clamp, clampFinite } from "../shared/math";

/** A stretch of a timeline, `[start, end]` in its units. */
export type RangeValue = readonly [start: number, end: number];

/** What a change moves: one edge, or the whole range with `both`. */
export type RangeEdge = "both" | "end" | "start";

export interface RangeLimits {
  duration: number;
  /** The shortest a range may be resized to. */
  minLength: number;
}

/** Orders a range's edges and keeps them on the timeline. */
export function normalizeRange(
  value: RangeValue,
  duration: number
): RangeValue {
  const first = clampFinite(value[0], 0, duration);
  const second = clampFinite(value[1], 0, duration);
  return first <= second ? [first, second] : [second, first];
}

/**
 * Moves one edge of `origin` by `delta`, or the whole range, without leaving
 * the timeline. An edge stops `minLength` short of the other one; a range
 * moved as a whole keeps its length.
 */
export function moveRange(
  origin: RangeValue,
  edge: RangeEdge,
  delta: number,
  limits: RangeLimits
): RangeValue {
  const [start, end] = origin;
  const { duration, minLength } = limits;
  if (edge === "both") {
    const length = end - start;
    const next = clamp(start + delta, 0, Math.max(0, duration - length));
    return [next, next + length];
  }
  if (edge === "start") {
    return [clamp(start + delta, 0, Math.max(0, end - minLength)), end];
  }
  return [
    start,
    clamp(end + delta, Math.min(duration, start + minLength), duration),
  ];
}
