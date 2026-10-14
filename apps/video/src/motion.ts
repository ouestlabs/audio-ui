import type { CSSProperties } from "react";
import { Easing, useCurrentFrame, useVideoConfig } from "remotion";

/** The only two curves: things arrive and leave with `enter`, and travel with `move`. Nothing overshoots. */
export const MOTION = {
  enter: Easing.bezier(0.23, 1, 0.32, 1),
  move: Easing.bezier(0.77, 0, 0.175, 1),
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;
/** 0 until `t` reaches 0, then up to 1 over `length` seconds. */
export const ramp = (t: number, length: number) => clamp(t / length, 0, 1);

/** `from` before `start`, `to` after `end`, eased between: every tween goes through it. */
export function tw(
  t: number,
  start: number,
  end: number,
  from: number,
  to: number,
  ease: (p: number) => number = MOTION.move
) {
  const progress =
    end <= start ? Number(t >= start) : ramp(t - start, end - start);
  return from + (to - from) * ease(progress);
}

/** A repeatable pseudo-random number in [0, 1), so every render draws the same frame. */
export const noise = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
};

/** The composition's time, in seconds. */
export function useSeconds() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
}

/**
 * The focus ring a control wears while a pointer turns it, faded by `active`:
 * pseudo-classes such as `:active` never match in a rendered frame.
 */
export function activeRing(active: number): CSSProperties | undefined {
  if (active <= 0) {
    return;
  }
  return {
    borderColor: `color-mix(in oklab, var(--ring) ${active * 100}%, transparent)`,
    boxShadow: `0 0 0 ${4 * active}px color-mix(in oklab, var(--ring) ${50 * active}%, transparent), 0 0 0 1px color-mix(in oklab, var(--foreground) 10%, transparent), 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`,
  };
}

/** Rises with a pointer pressing at `start`, falls as it lets go `hold` seconds later. */
export const pressed = (t: number, start: number, hold = 0.75) =>
  Math.min(ramp(t - start, 0.25), 1 - ramp(t - start - hold, 0.35));
