/** Without a reading for this long, the signal has stopped and so does the scroll. */
const MIN_STALL_MS = 250;

export interface LevelHistory {
  /** Give the current level, read at `nowMs`. The loudest one given since the last entry is what gets recorded. */
  feed: (level: number, nowMs: number) => void;
  /** The recorded levels, oldest first. The last one is the entry sliding in. */
  readonly levels: Float32Array;
  /** How far the newest entry has slid in, 0…1. */
  readonly progress: number;
  /** Bring the history up to `nowMs`. Returns whether it is still moving. */
  step: (nowMs: number) => boolean;
}

/**
 * Records a level every `intervalMs` into a window of `size` entries that
 * scrolls: each new entry pushes the oldest one out. Time only passes while
 * levels keep coming: when the signal stops the history holds still, and when
 * it comes back it carries on from there, the gap left out. `previous` brings
 * the newest entries of an earlier history over, so a resize doesn't wipe
 * what was recorded.
 */
export function createLevelHistory(
  size: number,
  intervalMs: number,
  previous?: Float32Array
): LevelHistory {
  const levels = new Float32Array(Math.max(1, Math.floor(size)));
  if (previous) {
    const kept = previous.subarray(
      Math.max(0, previous.length - levels.length)
    );
    levels.set(kept, levels.length - kept.length);
  }
  const interval = Math.max(1, intervalMs);
  const stallMs = Math.max(MIN_STALL_MS, interval * 4);
  /** The time the history has been brought up to. */
  let advancedTo: number | null = null;
  /** When the last level was given. */
  let fedAt = Number.NEGATIVE_INFINITY;
  /** Time since the newest entry was recorded. */
  let sinceEntry = 0;
  /** The last level given; held when nothing new arrives before the next entry. */
  let latest = 0;
  /** The loudest level given since the newest entry. */
  let pending = 0;

  return {
    feed: (level, nowMs) => {
      if (nowMs - fedAt > stallMs) {
        // Back after a silence: time picks up from here.
        advancedTo = nowMs;
      }
      fedAt = nowMs;
      latest = level;
      pending = Math.max(pending, level);
    },
    levels,
    get progress() {
      return sinceEntry / interval;
    },
    step: (nowMs) => {
      if (nowMs - fedAt > stallMs) {
        return false;
      }
      sinceEntry += Math.max(0, nowMs - (advancedTo ?? nowMs));
      advancedTo = nowMs;
      while (sinceEntry >= interval) {
        levels.copyWithin(0, 1);
        levels[levels.length - 1] = pending;
        pending = latest;
        sinceEntry -= interval;
      }
      return true;
    },
  };
}
