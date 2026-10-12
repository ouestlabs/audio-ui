import { clamp } from "../../shared/math.js";

/** Shift + arrows and Page Up/Down move this many steps at once. */
export const LARGE_STEP_MULTIPLIER = 10;

/** Only `disabled` and `dragging` become data attributes; the numbers stay in `state`. */
export const STATE_ATTRIBUTES_MAPPING = {
  maxX: () => null,
  maxY: () => null,
  minX: () => null,
  minY: () => null,
  value: () => null,
};

export type Axis = "x" | "y";

export function toPercent(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min || 1), 0, 1);
}
