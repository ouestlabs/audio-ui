import { clamp, clampFinite } from "../../../utils";

/** A stretch of the timeline, in `duration` units. */
export type RegionValue = readonly [start: number, end: number];

/** What a change moves: one edge, or the whole region with `both`. */
export type RegionEdge = "both" | "end" | "start";

export interface RegionLimits {
  duration: number;
  /** The shortest a region may be resized to. */
  minLength: number;
}

/** Orders a region's edges and keeps them on the timeline. */
export function normalizeRegion(
  value: RegionValue,
  duration: number
): RegionValue {
  const first = clampFinite(value[0], 0, duration);
  const second = clampFinite(value[1], 0, duration);
  return first <= second ? [first, second] : [second, first];
}

/**
 * Moves one edge of `origin` by `delta`, or the whole region, without leaving
 * the timeline. An edge stops `minLength` short of the other one; a region
 * moved as a whole keeps its length.
 */
export function moveRegion(
  origin: RegionValue,
  edge: RegionEdge,
  delta: number,
  limits: RegionLimits
): RegionValue {
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
