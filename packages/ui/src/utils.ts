// Internal helpers — bundled into the package so it ships with zero runtime
// dependencies. Not part of the public API.

export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;
export type Procedure<T> = (value: T) => void;
export type Func<U, T> = (value: U) => T;
export type AnyFunc = (...args: any[]) => any;
export type Point = { x: number; y: number };

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

export const isUndefined = (value: unknown): value is undefined =>
  value === undefined;

export const isNotUndefined = <T>(value: Optional<T>): value is T =>
  value !== undefined;

// A function declaration (not an arrow) so TypeScript narrows after the call.
export function panic(issue?: string | Error | unknown): never {
  throw typeof issue === "string" ? new Error(issue) : issue;
}

export const EmptyProcedure: Procedure<unknown> = (): void => {
  // no-op
};

export function assertType<T>(_value: unknown): asserts _value is T {
  // no-op
}

export const TAU = Math.PI * 2.0;
export const PI_HALF = Math.PI / 2.0;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export const clampUnit = (value: number): number =>
  Math.max(0.0, Math.min(value, 1.0));

export const quantizeRound = (value: number, interval: number): number =>
  Math.round(value / interval) * interval;

export const radToDeg = (rad: number): number => (rad * 180.0) / Math.PI;

export const degToRad = (deg: number): number => (deg / 180.0) * Math.PI;

/** Snap to `step` with `min` as the origin, without float noise (0.1 + 0.2). */
export function roundToStep(value: number, step: number, min: number): number {
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number(
    (Math.round((value - min) / step) * step + min).toFixed(decimals)
  );
}

/** Clamp into `min…max`; a non-finite value (NaN from a 0/0, ±Infinity) falls back to `min`. */
export const clampFinite = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? clamp(value, min, max) : min;
