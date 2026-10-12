import { clampUnit } from "@audio-ui/core";
import { fitPeaks, loudest, SILENCE_THRESHOLD } from "./levels";

/** Time constant of the fall after a peak, in milliseconds: levels rise at once and fall smoothly. */
const RELEASE_MS = 110;
/** A level this close to its target has nothing left to animate. */
const SETTLE_EPSILON = 0.002;

const PULSE_PERIOD_MS = 1250;
const PULSE_LEVEL = 0.1;
const WAVE_PERIOD_MS = 1500;
const WAVE_LEVEL = 0.16;
/** How many bars one cycle of the idle wave spans. */
const WAVE_LENGTH = 12;
const SWEEP_PERIOD_MS = 1200;
const SWEEP_LEVEL = 0.55;

/**
 * What the bars do while there is no signal: `none` rests them, `pulse` makes
 * them breathe together and `wave` runs a ripple along them.
 */
export type WaveformIdle = "none" | "pulse" | "wave";

export interface LevelsEngineOptions {
  count: number;
  /** Visual gain applied to the input. */
  gain: number;
  idle: WaveformIdle;
  /** Runs a sweep across the bars, for a connecting or decoding state. */
  loading: boolean;
  /** Resting level, 0…1. */
  minLevel: number;
  /** Mirrors the levels around the middle bar: the first level sits in the center. */
  mirrored: boolean;
  /** No release smoothing, idle animation or sweep. */
  reducedMotion: boolean;
}

export interface LevelsEngine {
  /** The level each bar shows, 0…1, never below `minLevel`. */
  readonly levels: Float32Array;
  /** Whether the last step left nothing to animate. */
  readonly settled: boolean;
  /** Advance to `nowMs` (a clock in milliseconds) with the latest input. */
  step: (nowMs: number, input: ArrayLike<number> | null | undefined) => void;
}

function idleLevel(idle: WaveformIdle, index: number, nowMs: number): number {
  if (idle === "pulse") {
    const phase = (nowMs / PULSE_PERIOD_MS) * Math.PI * 2;
    return PULSE_LEVEL * (0.5 - 0.5 * Math.cos(phase));
  }
  if (idle === "wave") {
    const phase = (nowMs / WAVE_PERIOD_MS - index / WAVE_LENGTH) * Math.PI * 2;
    return WAVE_LEVEL * (0.5 + 0.5 * Math.sin(phase));
  }
  return 0;
}

/** A bump that crosses the bars once per period, entering and leaving off the edges. */
function sweepLevel(index: number, count: number, nowMs: number): number {
  const spread = Math.max(1.5, count * 0.06);
  const margin = spread * 3;
  const cycle = (nowMs % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS;
  const center = cycle * (count + margin * 2) - margin;
  return SWEEP_LEVEL * Math.exp(-((index - center) ** 2) / (2 * spread ** 2));
}

/**
 * Turns an input of any length into the level of each of `count` bars: fitted
 * to the bar count, rising at once and falling smoothly, optionally mirrored,
 * with an idle animation while silent and a sweep while loading.
 */
export function createLevelsEngine(options: LevelsEngineOptions): LevelsEngine {
  const { gain, idle, loading, minLevel, mirrored, reducedMotion } = options;
  const count = Math.max(0, Math.floor(options.count));
  const half = mirrored ? Math.ceil(count / 2) : count;
  const targets = new Float32Array(half);
  const current = new Float32Array(count);
  const levels = new Float32Array(count).fill(clampUnit(minLevel));
  let lastMs: number | null = null;
  let settled = false;

  const sweeping = loading && !reducedMotion;
  const canIdle = idle !== "none" && !reducedMotion;

  /** Which fitted level bar `index` shows: mirrored, the distance from the middle. */
  const targetIndex = (index: number) =>
    mirrored
      ? Math.min(half - 1, Math.floor(Math.abs(index - (count - 1) / 2)))
      : index;

  /** What an animation adds to bar `index`: the loading sweep, or the idle motion while quiet. */
  const animated = (index: number, nowMs: number, quiet: boolean) => {
    if (sweeping) {
      return sweepLevel(index, count, nowMs);
    }
    return quiet && canIdle ? idleLevel(idle, index, nowMs) : 0;
  };

  const step: LevelsEngine["step"] = (nowMs, input) => {
    const elapsed = lastMs === null ? 0 : Math.max(0, nowMs - lastMs);
    lastMs = nowMs;
    const keep = reducedMotion ? 0 : Math.exp(-elapsed / RELEASE_MS);
    fitPeaks(input ?? [], targets);
    const quiet = loudest(targets) * gain < SILENCE_THRESHOLD;
    let converged = true;

    for (let index = 0; index < count; index += 1) {
      const target = Math.max(
        clampUnit((targets[targetIndex(index)] ?? 0) * gain),
        animated(index, nowMs, quiet)
      );
      const previous = current[index] ?? 0;
      const next =
        target >= previous ? target : target + (previous - target) * keep;
      current[index] = next;
      levels[index] = clampUnit(Math.max(minLevel, next));
      converged &&= Math.abs(next - target) <= SETTLE_EPSILON;
    }
    settled = converged && !(sweeping || (quiet && canIdle));
  };

  return {
    levels,
    get settled() {
      return settled;
    },
    step,
  };
}
