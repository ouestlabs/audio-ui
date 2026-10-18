/**
 * How a meter's reading follows the level it measures, over time. A VU meter
 * is slow and symmetric, a PPM is quick to rise and slow to fall. Both work in
 * dB and are pure: a host calls `step` once per frame with the time since the
 * last call, and draws the value it returns.
 */
export interface MeterBallistics {
  /** Puts the reading at `value` (dB), or at the floor when none is given. */
  reset: (value?: number) => void;
  /** Moves the reading toward `level` (dB) over `seconds`, and returns it. */
  step: (level: number, seconds: number) => number;
  /** The reading, in dB. */
  readonly value: number;
}

/** A VU meter takes 300 ms to reach 99% of a step in the level. */
const VU_RISE_SECONDS = 0.3;
/** The time for a one-pole filter to reach 99% of a step is `4.6` time constants. */
const TIME_CONSTANTS_TO_99_PERCENT = 4.6;

/** The lowest reading a meter shows, in dB: below it the level is silence. */
export const FLOOR_DB = -60;

/** A VU meter: symmetric, and it takes `riseSeconds` to reach 99% of a step. */
export function createVuBallistics(
  options: { riseSeconds?: number } = {}
): MeterBallistics {
  const tau =
    (options.riseSeconds ?? VU_RISE_SECONDS) / TIME_CONSTANTS_TO_99_PERCENT;
  let value = FLOOR_DB;
  return {
    get value() {
      return value;
    },
    reset(next = FLOOR_DB) {
      value = next;
    },
    step(level, seconds) {
      value += (level - value) * (1 - Math.exp(-seconds / tau));
      return value;
    },
  };
}

/**
 * A PPM meter: it rises in `attackSeconds`, a time constant, and falls at a
 * steady `releaseDbPerSecond`, so a peak reads long enough to be seen.
 */
export function createPpmBallistics(
  options: { attackSeconds?: number; releaseDbPerSecond?: number } = {}
): MeterBallistics {
  const tau = (options.attackSeconds ?? 0.005) / TIME_CONSTANTS_TO_99_PERCENT;
  const release = options.releaseDbPerSecond ?? 20 / 1.5;
  let value = FLOOR_DB;
  return {
    get value() {
      return value;
    },
    reset(next = FLOOR_DB) {
      value = next;
    },
    step(level, seconds) {
      if (level >= value) {
        value += (level - value) * (1 - Math.exp(-seconds / tau));
      } else {
        value = Math.max(level, value - release * seconds);
      }
      return value;
    },
  };
}
