import { degToRad, PI_HALF, radToDeg, TAU } from "../../shared/math.ts";
import { type ParameterScale, resolveScale } from "../../value/scale.ts";

/** Center of the 48×48 viewBox the arcs are drawn in. */
export const VIEWBOX_CENTER = 24;

/** Gap at the bottom of the dial: the sweep runs clockwise from bottom-left to bottom-right. */
export const ANGLE_GAP_RAD = Math.PI / 5;

/** Rotation at `min`, in degrees clockwise from 12 o'clock. */
export const START_ANGLE = 90 + radToDeg(PI_HALF + ANGLE_GAP_RAD);

/** Rotation travelled from `min` to `max`, in degrees. */
export const SWEEP_ANGLE = radToDeg(TAU - 2 * ANGLE_GAP_RAD);

/** Outer edge of the arcs in the viewBox; each stroke is centered inside it. */
export const ARC_OUTER_RADIUS = 23;

export const DEFAULT_ARC_STROKE_WIDTH = 3;

/** Vertical drag: pointer travel, in px, for the whole `min…max` range. */
export const VERTICAL_DRAG_RANGE_PX = 150;

/** Circular drag: inside this fraction of the diameter the angle is synced but not accumulated, so crossing the hub doesn't jump. */
export const CENTER_DEAD_ZONE_REL = 0.08;

export const CENTER_DEAD_ZONE_MIN_PX = 2;

/** A press that moves less than this is a tap; two quick taps reset the value. */
export const TAP_MAX_MOVE_PX = 12;

export const DOUBLE_TAP_MAX_MS = 320;

export const WHEEL_DELTA_EPSILON = 0.1;

/** Holding Shift turns the knob this much slower than the pointer moves. */
export const FINE_DRAG = 0.25;

/** With a scale that isn't linear, a key or wheel notch moves this share of the travel. */
export const POSITION_STEP = 0.01;

export const LARGE_POSITION_STEP = 0.1;

/** Only `disabled` and `dragging` become data attributes; the numbers stay in `state`. */
export const STATE_ATTRIBUTES_MAPPING = {
  max: () => null,
  min: () => null,
  value: () => null,
};

/**
 * The value `direction` steps away from `current`: by `step` (or `largeStep`)
 * on a linear scale, by a share of the travel on any other, and always by at
 * least one `step`.
 */
export function steppedValue(
  current: number,
  direction: -1 | 1,
  large: boolean,
  options: {
    largeStep: number;
    max: number;
    min: number;
    scale: ParameterScale;
    step: number;
  }
): number {
  const { largeStep, max, min, scale, step } = options;
  if (scale === LINEAR) {
    return current + direction * (large ? largeStep : step);
  }
  const position =
    scale.toPosition(current, min, max) +
    direction * (large ? LARGE_POSITION_STEP : POSITION_STEP);
  const next = scale.toValue(position, min, max);
  return Math.abs(next - current) < step ? current + direction * step : next;
}

export const LINEAR = resolveScale("linear");

/** SVG arc along the dial between two normalized positions (0…1). */
export function arcPath(radius: number, from: number, to: number): string {
  const point = (t: number) => {
    const angle = degToRad(START_ANGLE + t * SWEEP_ANGLE - 90);
    return {
      x: VIEWBOX_CENTER + radius * Math.cos(angle),
      y: VIEWBOX_CENTER + radius * Math.sin(angle),
    };
  };
  const start = point(from);
  const end = point(to);
  const largeArc = (to - from) * SWEEP_ANGLE > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function pointerAngle(
  clientX: number,
  clientY: number,
  rect: DOMRect
): number {
  return Math.atan2(
    clientY - (rect.top + rect.height / 2),
    clientX - (rect.left + rect.width / 2)
  );
}
