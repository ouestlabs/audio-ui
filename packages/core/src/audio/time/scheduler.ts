/**
 * The look-ahead scheduler of "A tale of two clocks" (Chris Wilson): a
 * JavaScript timer wakes often, and each time commits the steps that fall in
 * the next fraction of a second to the audio clock, whose times are exact
 * where a timer's are not. This is the pure core of it: a drift-free stepping
 * cursor and the loop that advances it. It knows nothing about the AudioContext
 * or about what gets played: the caller polls it with `ctx.currentTime` on a
 * timer and schedules each boundary it returns. Being pure, drive `advance`
 * across a fake timeline and assert the boundaries it emits, no audio needed.
 */

/** How far ahead of `now` boundaries are committed, in seconds: the article's 100 ms. */
export const SCHEDULE_AHEAD_SECONDS = 0.1;
/** How often to poll the scheduler, in milliseconds: the article's 25 ms. */
export const SCHEDULER_POLL_MS = 25;
/**
 * How late a boundary may be and still be played, half a second. A stall that
 * short (a layout, a garbage collection) is caught up on: the steps it missed
 * are emitted so none is lost, a little late. A longer one, a hidden tab whose
 * timer ran once a second or a suspended laptop, is a dropout the listener
 * hears anyway, and replaying every step missed would sound them all at once:
 * the cursor jumps ahead by whole steps to where the time now is, and the
 * music carries on in time.
 */
export const MAX_CATCH_UP_SECONDS = 0.5;

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

/** Whether the spacing is a step forward in time: a zero, negative or `NaN` spacing never reaches the horizon. */
const isStepping = ({ secondsPerStep }: SchedulerConfig) =>
  Number.isFinite(secondsPerStep) && secondsPerStep > 0;

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
 * self-correcting: a poll delayed past a whole step catches up by emitting the
 * boundaries it missed rather than letting one slip past unscheduled, up to
 * `MAX_CATCH_UP_SECONDS` late, past which it skips them (see there). A spacing
 * that is not a positive number emits nothing and leaves the cursor as it was,
 * where it would otherwise never leave the loop.
 */
export function advance(
  cursor: SchedulerCursor,
  now: number,
  config: SchedulerConfig
): { boundaries: StepBoundary[]; cursor: SchedulerCursor } {
  if (!isStepping(config)) {
    return { boundaries: [], cursor };
  }
  const horizon = now + SCHEDULE_AHEAD_SECONDS;
  const boundaries: StepBoundary[] = [];
  let step = wrapStep(cursor.nextStep, config);
  let time = cursor.nextStepTime;
  if (now - time > MAX_CATCH_UP_SECONDS) {
    const skipped = Math.floor((now - time) / config.secondsPerStep);
    step = wrapStep(step + skipped, config);
    time += skipped * config.secondsPerStep;
  }
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
  if (!isStepping(config)) {
    return config.regionStart;
  }
  const length = regionLength(config);
  const elapsedSteps = (now - anchor.time) / config.secondsPerStep;
  const within =
    (((anchor.step - config.regionStart + elapsedSteps) % length) + length) %
    length;
  return config.regionStart + within;
}

/**
 * The anchor to carry on with when the tempo changes while playing. The
 * playhead keeps the position it has at `now` and counts from there at the new
 * spacing. Without it `positionAt` rereads all the time since the old anchor at
 * the new spacing, and the playhead jumps (a tempo of 60 after 3 s at 120 puts
 * a 16 step loop on step 12 instead of step 8).
 */
export function anchorForTempoChange(
  now: number,
  anchor: SchedulerAnchor,
  previous: SchedulerConfig
): SchedulerAnchor {
  return { step: positionAt(now, anchor, previous), time: now };
}
