/**
 * How a meter's reading follows the level it measures, over time. A VU meter
 * is slow and symmetric, with the small overshoot of a swinging pointer; a PPM
 * is quick to rise and slow to fall. Both take and give a level in dB and are
 * pure: a host calls `step` once per frame with the time since the last call,
 * and draws the value it returns.
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
/** A damping ratio of 0.81 makes a pointer overshoot a step by 1.3%, within the 1 to 1.5% of the standard. */
const VU_DAMPING = 0.81;
/** A frame is split into steps of this length, in seconds, to follow the pointer closely. */
const VU_STEP_SECONDS = 0.001;
/** A VU meter has settled one second after any step, so a longer pause is cut to it. */
const VU_SETTLE_SECONDS = 1;
/** The time for a one-pole filter to reach 99% of a step is `4.6` time constants. */
const TIME_CONSTANTS_TO_99_PERCENT = 4.6;

/** The lowest reading a meter shows, in dB: below it the level is silence. */
export const FLOOR_DB = -60;

/** A level in dB as the voltage it stands for: 1 at 0 dB, and none at the floor. */
const toVoltage = (level: number) =>
  level <= FLOOR_DB ? 0 : 10 ** (level / 20);

/** A voltage as a level in dB, no lower than the floor. */
const toLevel = (voltage: number) =>
  voltage <= 0 ? FLOOR_DB : Math.max(FLOOR_DB, 20 * Math.log10(voltage));

/** How far a pointer with a natural frequency of 1 rad/s has come after `time` seconds of a step of 1. */
function stepResponse(time: number) {
  const damped = Math.sqrt(1 - VU_DAMPING ** 2);
  return (
    1 -
    Math.exp(-VU_DAMPING * time) *
      (Math.cos(damped * time) +
        (VU_DAMPING / damped) * Math.sin(damped * time))
  );
}

/** The time, for a natural frequency of 1 rad/s, at which the pointer first reaches 99% of a step. */
function timeToReach99Percent() {
  let low = 0;
  // The first peak: the pointer overshoots, so it is past 99% there.
  let high = Math.PI / Math.sqrt(1 - VU_DAMPING ** 2);
  for (let pass = 0; pass < 40; pass += 1) {
    const middle = (low + high) / 2;
    if (stepResponse(middle) < 0.99) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return high;
}

/**
 * A VU meter: its pointer follows the voltage of the level as a mass on a
 * spring does, symmetrically, taking `riseSeconds` to first reach 99% of a
 * step and overshooting it by 1.3%, as the standard says.
 */
export function createVuBallistics(
  options: { riseSeconds?: number } = {}
): MeterBallistics {
  const natural =
    timeToReach99Percent() / (options.riseSeconds ?? VU_RISE_SECONDS);
  let position = 0;
  let speed = 0;
  return {
    get value() {
      return toLevel(position);
    },
    reset(next = FLOOR_DB) {
      position = toVoltage(next);
      speed = 0;
    },
    step(level, seconds) {
      const target = toVoltage(level);
      const elapsed = Math.min(Math.max(seconds, 0), VU_SETTLE_SECONDS);
      const steps = Math.max(1, Math.ceil(elapsed / VU_STEP_SECONDS));
      const interval = elapsed / steps;
      for (let pass = 0; pass < steps; pass += 1) {
        speed +=
          (natural ** 2 * (target - position) -
            2 * VU_DAMPING * natural * speed) *
          interval;
        position += speed * interval;
        if (position < 0) {
          // The left stop of the pointer.
          position = 0;
          speed = 0;
        }
      }
      return toLevel(position);
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
