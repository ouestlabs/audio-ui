import {
  moveRange,
  type RangeEdge,
  type RangeLimits,
  type RangeValue,
} from "../../value/range";

/** Grid lines `step` apart, starting from `offset`. A `step` of 0 or less is no grid. */
export interface Grid {
  offset: number;
  step: number;
}

/** Whether a gesture asks to ignore the grid: Cmd on a Mac, Ctrl elsewhere. */
export function bypassesGrid(event: {
  ctrlKey?: boolean;
  metaKey?: boolean;
}): boolean {
  return Boolean(event.metaKey || event.ctrlKey);
}

/** The grid line nearest `value`. */
export function snapToGrid(value: number, grid: Grid): number {
  if (!(grid.step > 0)) {
    return value;
  }
  return (
    Math.round((value - grid.offset) / grid.step) * grid.step + grid.offset
  );
}

/**
 * Where something dragged from `origin` should land, given where the pointer
 * would put it. Two answers are reasonable, and the one nearer the pointer
 * wins: on a grid line, or moved by a whole number of steps from where it
 * was. Without the second, anything that starts between two lines jumps onto
 * one the moment it is touched, and can never move by exactly one step.
 */
export function snapMove(target: number, origin: number, grid: Grid): number {
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
  const from = edge === "end" ? origin[1] : origin[0];
  return moveRange(
    origin,
    edge,
    snapMove(from + delta, from, grid) - from,
    limits
  );
}
