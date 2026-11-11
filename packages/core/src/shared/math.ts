/** `value` kept within `min` and `max`. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/** `value` kept within 0 and 1. */
export const clampUnit = (value: number): number =>
  Math.max(0.0, Math.min(value, 1.0));

/** Clamp into `min…max`; a non-finite value (NaN from a 0/0, ±Infinity) falls back to `min`. */
export const clampFinite = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? clamp(value, min, max) : min;

/** `value` rounded to the nearest multiple of `interval`. */
export const quantizeRound = (value: number, interval: number): number =>
  Math.round(value / interval) * interval;

/** Snap to `step` with `min` as the origin, without float noise (0.1 + 0.2). */
export function roundToStep(value: number, step: number, min: number): number {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number(
    (Math.round((value - min) / step) * step + min).toFixed(decimals)
  );
}

/** A full turn in radians: 2π. */
export const TAU = Math.PI * 2.0;
/** A quarter turn in radians: π/2. */
export const PI_HALF = Math.PI / 2.0;

/** An angle in radians, in degrees. */
export const radToDeg = (rad: number): number => (rad * 180.0) / Math.PI;

/** An angle in degrees, in radians. */
export const degToRad = (deg: number): number => (deg / 180.0) * Math.PI;

/** A point on two axes. */
export type Point = { x: number; y: number };
