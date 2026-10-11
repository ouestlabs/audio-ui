/**
 * Framework-free core of the look-ahead scheduler shared by `use-step-clock`
 * and `use-transport-clock`. It owns the drift-free stepping cursor and the
 * self-correcting catch-up loop, and knows nothing about React, AudioContext,
 * or what gets played, the hooks bind it to `ctx.currentTime` + `setInterval`.
 * Being pure, it is the whole test surface: drive `advance` across a fake
 * timeline and assert the emitted `(step, time)` boundaries, no audio needed.
 */

/** How far ahead of `now` boundaries are committed, in seconds. */
export const SCHEDULE_AHEAD_SECONDS = 0.1;
/** How often the hooks poll the core, in milliseconds. */
export const SCHEDULER_POLL_MS = 25;

export interface SchedulerConfig {
  /** One past the last step of the window, exclusive. `totalSteps` for a full-grid clock. */
  regionEnd: number;
  /** First step of the looping window, inclusive. `0` for a full-grid clock. */
  regionStart: number;
  /**
   * Seconds between two consecutive steps, `60 / bpm / stepsPerBeat`. Read
   * fresh on every `advance` so a tempo change takes effect at the next
   * boundary, not on the next stop/start.
   */
  secondsPerStep: number;
}

export interface SchedulerCursor {
  /** The step the next emitted boundary will carry. */
  nextStep: number;
  /** The audio time of that boundary. */
  nextStepTime: number;
}

export interface StepBoundary {
  step: number;
  /** Absolute audio time, pass straight to node `.start()`/`.stop()` for sample-accurate scheduling. */
  time: number;
}

/** The audio-time / step pair a running clock is anchored to, for deriving the display position. */
export interface SchedulerAnchor {
  step: number;
  time: number;
}

function regionLength(config: SchedulerConfig): number {
  return Math.max(1, config.regionEnd - config.regionStart);
}

/** Wraps `step` back into `[regionStart, regionEnd)`, tolerating a step left stale by a shrunk region. */
function wrapStep(step: number, config: SchedulerConfig): number {
  const length = regionLength(config);
  return (
    config.regionStart +
    ((((step - config.regionStart) % length) + length) % length)
  );
}

/** A cursor that emits `step` at `now`, the seed for `start()` and for every re-anchor (seek, region commit). */
export function anchoredCursor(now: number, step: number): SchedulerCursor {
  return { nextStep: step, nextStepTime: now };
}

/**
 * Advances `cursor`, emitting every step boundary now within
 * `SCHEDULE_AHEAD_SECONDS` of `now`. The `while` (not `if`) is what makes this
 * self-correcting: a poll delayed past a whole step, a stalled main thread, a
 * throttled background tab, catches up by emitting the missed boundaries
 * rather than letting one slip past unscheduled.
 */
export function advance(
  cursor: SchedulerCursor,
  now: number,
  config: SchedulerConfig
): { boundaries: StepBoundary[]; cursor: SchedulerCursor } {
  const horizon = now + SCHEDULE_AHEAD_SECONDS;
  const boundaries: StepBoundary[] = [];
  let step = wrapStep(cursor.nextStep, config);
  let time = cursor.nextStepTime;
  while (time < horizon) {
    boundaries.push({ step, time });
    time += config.secondsPerStep;
    step = wrapStep(step + 1, config);
  }
  return { boundaries, cursor: { nextStep: step, nextStepTime: time } };
}

/**
 * The continuous playhead position, in fractional full-grid steps, at `now`.
 * Derived from the anchor (the audio time at which the playhead sat exactly on
 * `anchor.step`), so it is self-correcting for display regardless of how many
 * loop iterations have actually played.
 */
export function positionAt(
  now: number,
  anchor: SchedulerAnchor,
  config: SchedulerConfig
): number {
  const length = regionLength(config);
  const elapsedSteps = (now - anchor.time) / config.secondsPerStep;
  const within =
    (((anchor.step - config.regionStart + elapsedSteps) % length) + length) %
    length;
  return config.regionStart + within;
}
