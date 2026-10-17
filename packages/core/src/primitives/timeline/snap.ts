import {
  moveRange,
  type RangeEdge,
  type RangeLimits,
  type RangeValue,
} from "../../value/range.ts";

/**
 * Grid lines `step` apart, starting from `offset`. A `step` of 0 or less is no
 * grid. `points` are places that pull harder than the lines, such as the
 * edges of other clips and the locators: within `radius` of one, a dragged
 * thing lands on it. The radius is set per gesture from how many units a few
 * pixels are.
 */
export interface Grid {
  offset: number;
  points?: readonly number[];
  radius?: number;
  step: number;
}

/** How far from a snap point, in px, a dragged thing is pulled onto it. */
export const SNAP_RADIUS_PX = 8;

/** The grid with its points pulling from `radius` units away, so a gesture can set it from its own zoom. */
export function withSnapRadius(grid: Grid, radius: number): Grid {
  return grid.points?.length ? { ...grid, radius } : grid;
}

/** The point of `grid` nearest `value` within its radius, or null when none is that close. */
export function nearestSnapPoint(value: number, grid: Grid): number | null {
  const radius = grid.radius ?? 0;
  let found: number | null = null;
  for (const point of grid.points ?? []) {
    const distance = Math.abs(point - value);
    if (
      distance <= radius &&
      (found === null || distance < Math.abs(found - value))
    ) {
      found = point;
    }
  }
  return found;
}

/** Whether a gesture asks to ignore the grid: Cmd on a Mac, Ctrl elsewhere. */
export function bypassesGrid(event: {
  ctrlKey?: boolean;
  metaKey?: boolean;
}): boolean {
  return Boolean(event.metaKey || event.ctrlKey);
}

/** The snap point within reach of `value`, or else the grid line nearest it. */
export function snapToGrid(value: number, grid: Grid): number {
  const point = nearestSnapPoint(value, grid);
  if (point !== null) {
    return point;
  }
  if (!(grid.step > 0)) {
    return value;
  }
  return (
    Math.round((value - grid.offset) / grid.step) * grid.step + grid.offset
  );
}

/**
 * Where something dragged from `origin` should land, given where the pointer
 * would put it. A snap point within reach wins. Otherwise two answers are
 * reasonable, and the one nearer the pointer wins: on a grid line, or moved
 * by a whole number of steps from where it was. Without the second, anything that starts between two lines jumps onto
 * one the moment it is touched, and can never move by exactly one step.
 */
export function snapMove(target: number, origin: number, grid: Grid): number {
  const point = nearestSnapPoint(target, grid);
  if (point !== null) {
    return point;
  }
  if (!(grid.step > 0)) {
    return target;
  }
  const onLine = snapToGrid(target, grid);
  const bySteps =
    origin + Math.round((target - origin) / grid.step) * grid.step;
  return Math.abs(onLine - target) <= Math.abs(bySteps - target)
    ? onLine
    : bySteps;
}

/**
 * Where a span `length` long, dragged from `origin`, should start when the
 * pointer would start it at `target`: either of its edges lands on a snap
 * point within reach (the nearer one wins), or else its start snaps the way
 * anything dragged does.
 */
export function snapSpanMove(
  target: number,
  origin: number,
  length: number,
  grid: Grid
): number {
  const startPoint = nearestSnapPoint(target, grid);
  const endPoint = nearestSnapPoint(target + length, grid);
  if (startPoint !== null || endPoint !== null) {
    if (endPoint === null) {
      return startPoint ?? target;
    }
    if (
      startPoint === null ||
      Math.abs(endPoint - (target + length)) < Math.abs(startPoint - target)
    ) {
      return endPoint - length;
    }
    return startPoint;
  }
  return snapMove(target, origin, { ...grid, points: undefined });
}

/** The grid without the given points, so something dragged is not pulled onto its own edges. */
export function withoutSnapPoints(grid: Grid, own: readonly number[]): Grid {
  return grid.points?.length
    ? { ...grid, points: grid.points.filter((point) => !own.includes(point)) }
    : grid;
}

/**
 * Where one edge of a range dragged from `origin`, or the whole range with
 * `"both"`, should land when the pointer has moved it by `delta`: the
 * dragged edge snaps the way anything dragged does, and the range keeps
 * within the timeline and its minimum length.
 */
export function snapRangeMove(
  origin: RangeValue,
  edge: RangeEdge,
  delta: number,
  limits: RangeLimits,
  grid: Grid
): RangeValue {
  if (edge === "both") {
    const length = origin[1] - origin[0];
    return moveRange(
      origin,
      edge,
      snapSpanMove(origin[0] + delta, origin[0], length, grid) - origin[0],
      limits
    );
  }
  const from = edge === "end" ? origin[1] : origin[0];
  return moveRange(
    origin,
    edge,
    snapMove(from + delta, from, grid) - from,
    limits
  );
}
