import type { Nullable } from "../../shared/lang.ts";
import {
  clamp,
  clampUnit,
  type Point as GeomPoint,
} from "../../shared/math.ts";

/** How far a segment can bend: its curve exponent runs from 1/8 to 8 at the ends of -1…1. */
export const CURVE_EXPONENT_RANGE = 3;
/** Straight lines between samples of a bent segment. */
export const CURVE_SAMPLES = 24;
/** A curve this close to flat is taken as straight, and dropped. */
export const CURVE_EPSILON = 0.005;
/** Keyboard step for a segment's curve, as a multiple of `step`. */
export const CURVE_STEP_MULTIPLIER = 5;
/** Shift + arrows move this many steps at once. */
export const LARGE_STEP_MULTIPLIER = 10;

/**
 * A point of the ramp, and how the segment leaving it bends: `curve` from -1
 * to 1, 0 or unset for a straight line. A positive curve holds the start of
 * the segment and rushes its end, a negative one the opposite. The last
 * point's curve has no segment to bend.
 */
export type Breakpoint = GeomPoint & { curve?: number };

/** Where along a bent segment a share `t` of its length lands, as a share of its rise. */
export function segmentShape(t: number, curve: number | undefined): number {
  return curve ? t ** (2 ** (curve * CURVE_EXPONENT_RANGE)) : t;
}

/** The curve that puts a segment's midpoint at height `y`, or null when the segment is flat and has nothing to bend. */
export function curveForMidpoint(
  from: GeomPoint,
  to: GeomPoint,
  y: number
): number | null {
  const rise = to.y - from.y;
  if (Math.abs(rise) < 1e-6) {
    return null;
  }
  const share = clamp((y - from.y) / rise, 0.02, 0.98);
  const exponent = Math.log(share) / Math.log(0.5);
  return clamp(Math.log2(exponent) / CURVE_EXPONENT_RANGE, -1, 1);
}

export function sortPoints<T extends GeomPoint>(points: T[]): T[] {
  return [...points].sort((a, b) => a.x - b.x);
}

/** One decimal place is plenty of precision for a 0-100 SVG coordinate, and keeps the `points` string short during drag. */
export function roundCoord(n: number): number {
  return Math.round(n * 10) / 10;
}

export function sanitizePoints(points: Breakpoint[]): Breakpoint[] {
  return sortPoints(
    points.map((p) => {
      const point: Breakpoint = { x: clampUnit(p.x), y: clampUnit(p.y) };
      if (p.curve !== undefined && Math.abs(p.curve) >= CURVE_EPSILON) {
        point.curve = clamp(p.curve, -1, 1);
      }
      return point;
    })
  );
}

export function samePoints(a: Breakpoint[], b: Breakpoint[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (point, i) =>
        point.x === b[i]?.x &&
        point.y === b[i]?.y &&
        point.curve === b[i]?.curve
    )
  );
}

/** Clamp a candidate point's x between its neighbors in `base` (so points can never cross or reorder) and y to [0,1]. */
export function clampToNeighbors(
  base: Breakpoint[],
  index: number,
  next: GeomPoint
): Nullable<GeomPoint> {
  if (!base[index]) {
    return null;
  }
  const prev = base[index - 1];
  const nextNeighbor = base[index + 1];
  return {
    x: clamp(next.x, prev ? prev.x : 0, nextNeighbor ? nextNeighbor.x : 1),
    y: clampUnit(next.y),
  };
}

/**
 * `point` added to `base`. Added inside a bent segment it sits on the curve,
 * and each half gets the curve that traces the part of the original it
 * replaces, so adding a point does not change the shape.
 */
export function insertPoint(
  base: Breakpoint[],
  point: GeomPoint
): { index: number; value: Breakpoint[] } {
  const x = clampUnit(point.x);
  const y = clampUnit(point.y);
  const leftIndex = base.findLastIndex((existing) => existing.x <= x);
  const left = base[leftIndex];
  const right = base[leftIndex + 1];
  if (left?.curve && right && right.x > left.x) {
    const t = (x - left.x) / (right.x - left.x);
    const onCurve = (share: number) =>
      left.y + (right.y - left.y) * segmentShape(share, left.curve);
    const added: Breakpoint = { x, y: onCurve(t) };
    const leftCurve = curveForMidpoint(left, added, onCurve(t / 2));
    const rightCurve = curveForMidpoint(added, right, onCurve((1 + t) / 2));
    const { curve: _bent, ...straightLeft } = left;
    const value = [...base];
    value[leftIndex] =
      leftCurve === null || Math.abs(leftCurve) < CURVE_EPSILON
        ? straightLeft
        : { ...straightLeft, curve: leftCurve };
    if (rightCurve !== null && Math.abs(rightCurve) >= CURVE_EPSILON) {
      added.curve = rightCurve;
    }
    value.splice(leftIndex + 1, 0, added);
    return { index: leftIndex + 1, value };
  }
  const added: Breakpoint = { x, y };
  const value = sortPoints([...base, added]);
  return { index: value.indexOf(added), value };
}

/** How far a key bends a segment, or null for a key that does not: up lifts the handle, so a rising segment bends one way and a falling one the other. */
export function curveKeyDelta(
  event: { key: string; shiftKey: boolean },
  from: GeomPoint,
  to: GeomPoint,
  step: number
): number | null {
  const direction = { ArrowDown: -1, ArrowUp: 1 }[event.key];
  if (direction === undefined) {
    return null;
  }
  const lift = to.y > from.y ? -1 : 1;
  const distance =
    step * CURVE_STEP_MULTIPLIER * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
  return direction * lift * distance;
}

/** Rounds a normalized coordinate to the nearest multiple of `step`; a step of 0 leaves it. */
export function snapTo(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}

/**
 * Where along a bent segment to put the vertices of its drawing: evenly in
 * length, and evenly in height, so a steep stretch is sampled as finely as a
 * flat one and does not turn into a corner.
 */
export function curveSamples(curve: number): number[] {
  const exponent = 2 ** (curve * CURVE_EXPONENT_RANGE);
  const samples = new Set<number>();
  for (let sample = 1; sample < CURVE_SAMPLES; sample += 1) {
    const share = sample / CURVE_SAMPLES;
    samples.add(share);
    samples.add(share ** (1 / exponent));
  }
  return [...samples].filter((t) => t > 0 && t < 1).sort((a, b) => a - b);
}

/** Polyline coordinates: flat lead-in from x=0 to the first point, the points themselves with each bent segment sampled between them, flat lead-out from the last point to x=1. */
export function polylinePoints(value: Breakpoint[]): string {
  const [first] = value;
  const last = value.at(-1);
  if (!(first && last)) {
    return "";
  }
  const coordinate = (x: number, y: number) =>
    `${roundCoord(x * 100)},${roundCoord((1 - y) * 100)}`;
  const coordinates = [coordinate(0, first.y)];
  value.forEach((point, index) => {
    coordinates.push(coordinate(point.x, point.y));
    const next = value[index + 1];
    if (!(next && point.curve)) {
      return;
    }
    for (const t of curveSamples(point.curve)) {
      coordinates.push(
        coordinate(
          point.x + (next.x - point.x) * t,
          point.y + (next.y - point.y) * segmentShape(t, point.curve)
        )
      );
    }
  });
  coordinates.push(coordinate(1, last.y));
  return coordinates.join(" ");
}

/** How far from a curve, as a share of the graph's height, a press still counts as on it. */
export const CURVE_HIT_TOLERANCE = 0.12;

/** Where a bent segment is at a share `t` of its length, as a level. */
export function levelAt(from: Breakpoint, to: Breakpoint, t: number): number {
  return from.y + (to.y - from.y) * segmentShape(t, from.curve);
}

/**
 * The segment that has the point (x, y) on it or close to it, or null: one
 * that is not flat, since a flat segment has nothing to bend.
 */
export function segmentNear(
  value: Breakpoint[],
  x: number,
  y: number
): number | null {
  for (let index = 0; index < value.length - 1; index += 1) {
    const from = value[index];
    const to = value[index + 1];
    if (!(from && to) || x < from.x || x > to.x || to.x <= from.x) {
      continue;
    }
    if (Math.abs(to.y - from.y) < 1e-6) {
      return null;
    }
    const at = levelAt(from, to, (x - from.x) / (to.x - from.x));
    return Math.abs(at - y) <= CURVE_HIT_TOLERANCE ? index : null;
  }
  return null;
}
