import { clamp } from "@ui-sdk/core/number";
import { adaptiveSamples } from "../primitive";

/**
 * The geometry of a breakpoint envelope, with nothing to draw: its points and
 * how a segment between two of them bends, where a point is added, how the
 * line is sampled into a polyline. Shared by the envelope and by what edits
 * an automation lane.
 */

/**
 * A point of the ramp, and how the segment leaving it bends: `curve` from -1
 * to 1, 0 or unset for a straight line. A positive curve holds the start of
 * the segment and rushes its end, a negative one the opposite. The last
 * point's curve has no segment to bend.
 */
export interface Breakpoint {
  curve?: number;
  x: number;
  y: number;
}

/** A grid step in normalized units: one for both axes, or one for each (0 leaves that axis free). */
export type EnvelopeSnap = number | { x: number; y: number };

/** How far a segment can bend: the rate of its exponential at the ends of -1 to 1. */
const CURVE_RATE = 11;
/** Straight lines between samples of a bent segment: where its drawing starts, before it adds vertices where the bend is tight. */
const CURVE_SAMPLES = 24;
/** How far a bent segment's drawing may stray from it, as a share of the graph: a tenth of a pixel on a graph 200 px high. */
const CURVE_TOLERANCE = 0.0005;
/** A curve this close to flat is taken as straight, and dropped. */
export const CURVE_EPSILON = 0.005;
/** Shift with the arrows moves this many steps at once. */
const LARGE_STEP_MULTIPLIER = 10;
/** Keyboard step for a segment's curve, as a multiple of `step`. */
const CURVE_STEP_MULTIPLIER = 5;
/** How far from a curve, as a share of the graph's height, a press still counts as on it. */
const CURVE_HIT_TOLERANCE = 0.12;
/**
 * Where along a bent segment a share `t` of its length lands, as a share of
 * its rise: the exponential of an analog envelope stage.
 */
export function segmentShape(t: number, curve: number | undefined) {
  if (!curve) {
    return t;
  }
  const rate = curve * CURVE_RATE;
  return Math.expm1(rate * t) / Math.expm1(rate);
}

/** Where a bent segment is at a share `t` of its length, as a level. */
export const levelAt = (from: Breakpoint, to: Breakpoint, t: number) =>
  from.y + (to.y - from.y) * segmentShape(t, from.curve);

/** The curve that puts a segment's midpoint at height `y`, or null when the segment is flat. */
export function curveForMidpoint(from: Breakpoint, to: Breakpoint, y: number) {
  const rise = to.y - from.y;
  if (Math.abs(rise) < 1e-6) {
    return null;
  }
  // The middle of the exponential is at 1 / (e^(k/2) + 1), so k = 2 ln((1 - share) / share).
  const share = clamp((y - from.y) / rise, 0.001, 0.999);
  return clamp((2 * Math.log((1 - share) / share)) / CURVE_RATE, -1, 1);
}

export const sortPoints = <T extends Breakpoint>(points: T[]) =>
  [...points].sort((a, b) => a.x - b.x);

/** The points kept on the graph: each within 0 and 1, a curve within -1 and 1 (dropped when it is flat), in order along x. */
export function sanitizePoints(points: readonly Breakpoint[]): Breakpoint[] {
  return sortPoints(
    points.map((p) => {
      const point: Breakpoint = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) };
      if (p.curve !== undefined && Math.abs(p.curve) >= CURVE_EPSILON) {
        point.curve = clamp(p.curve, -1, 1);
      }
      return point;
    })
  );
}

/** Whether two lists hold the same points, curves included, in the same order. */
export const samePoints = (a: Breakpoint[], b: Breakpoint[]) =>
  a.length === b.length &&
  a.every(
    (point, i) =>
      point.x === b[i]?.x && point.y === b[i]?.y && point.curve === b[i]?.curve
  );

/** A candidate point with its x kept between its neighbors, so points never cross, and y within the graph. */
export function clampToNeighbors(
  base: Breakpoint[],
  index: number,
  next: { x: number; y: number }
) {
  if (!base[index]) {
    return null;
  }
  const prev = base[index - 1];
  const after = base[index + 1];
  return {
    x: clamp(next.x, prev ? prev.x : 0, after ? after.x : 1),
    y: clamp(next.y, 0, 1),
  };
}

/**
 * `point` added to `base`. Added inside a bent segment it sits on the curve,
 * and each half gets the curve that traces the part of the original it
 * replaces, so adding a point does not change the shape.
 */
export function insertPoint(
  base: Breakpoint[],
  point: { x: number; y: number }
) {
  const x = clamp(point.x, 0, 1);
  const y = clamp(point.y, 0, 1);
  const leftIndex = base.findLastIndex((existing) => existing.x <= x);
  const left = base[leftIndex];
  const right = base[leftIndex + 1];
  if (left?.curve && right && right.x > left.x) {
    const t = (x - left.x) / (right.x - left.x);
    const onCurve = (share: number) => levelAt(left, right, share);
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

/** How far a key bends a segment, or null for a key that does not: up lifts the handle. */
export function curveKeyDelta(
  event: KeyboardEvent,
  from: Breakpoint,
  to: Breakpoint,
  step: number
) {
  const direction = { ArrowDown: -1, ArrowUp: 1 }[event.key];
  if (direction === undefined) {
    return null;
  }
  const lift = to.y > from.y ? -1 : 1;
  return (
    direction *
    lift *
    step *
    CURVE_STEP_MULTIPLIER *
    (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1)
  );
}

/** Rounds a normalized coordinate to the nearest multiple of `step`; a step of 0 leaves it. */
export const snapTo = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : value;

/** A point on the grid of `snap`. */
export const snapPoint = (at: { x: number; y: number }, snap: EnvelopeSnap) =>
  typeof snap === "number"
    ? { x: snapTo(at.x, snap), y: snapTo(at.y, snap) }
    : { x: snapTo(at.x, snap.x), y: snapTo(at.y, snap.y) };

/** The segment that has the point (x, y) on it or close to it, or null: one that is not flat. */
export function segmentNear(value: Breakpoint[], x: number, y: number) {
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

/** Where along a bent segment to put the vertices of its drawing: evenly in length, and evenly in height. */
export function curveSamples(curve: number) {
  const rate = curve * CURVE_RATE;
  const samples = new Set<number>();
  for (let sample = 1; sample < CURVE_SAMPLES; sample += 1) {
    const share = sample / CURVE_SAMPLES;
    samples.add(share);
    samples.add(Math.log1p(share * Math.expm1(rate)) / rate);
  }
  return [...samples].filter((t) => t > 0 && t < 1).sort((a, b) => a - b);
}

/** Polyline coordinates in a 100 by 100 view box: flat lead-in from x 0 to the first point, the points with each bent segment sampled between them, flat lead-out to x 100. */
export function polylinePoints(value: Breakpoint[]): string {
  const [first] = value;
  const last = value.at(-1);
  if (!(first && last)) {
    return "";
  }
  // A graph stretched across a long arrangement keeps four decimals of x, so a bend is not drawn in steps.
  const coordinate = (x: number, y: number) =>
    `${Math.round(x * 1e6) / 1e4},${Math.round((1 - y) * 1000) / 10}`;
  const coordinates = [coordinate(0, first.y)];
  value.forEach((point, index) => {
    coordinates.push(coordinate(point.x, point.y));
    const next = value[index + 1];
    if (!(next && point.curve)) {
      return;
    }
    const bent = adaptiveSamples(
      (t) => levelAt(point, next, t),
      [0, ...curveSamples(point.curve), 1],
      CURVE_TOLERANCE,
      next.x - point.x
    );
    for (const [t, level] of bent.slice(1, -1)) {
      coordinates.push(coordinate(point.x + (next.x - point.x) * t, level));
    }
  });
  coordinates.push(coordinate(1, last.y));
  return coordinates.join(" ");
}