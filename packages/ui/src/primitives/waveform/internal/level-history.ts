/** Without a reading for this long, the signal has stopped and so does the scroll. */
const MIN_STALL_MS = 250;

export interface LevelHistory {
  /** Give the current level. The loudest one given since the last entry is what gets recorded. */
  feed: (level: number) => void;
  /** The recorded levels, oldest first. The last one is the entry sliding in. */
  readonly levels: Float32Array;
  /** How far the newest entry has slid in, 0…1. */
  readonly progress: number;
  /** Advance the clock by `elapsedMs`. Returns whether the history is still moving. */
  step: (elapsedMs: number) => boolean;
}

/**
 * Records a level every `intervalMs` into a window of `size` entries that
 * scrolls: each new entry pushes the oldest one out. Time only passes while
 * levels keep coming; when the signal stops, the history holds still.
 * `previous` carries the newest entries of an earlier history over, so a
 * resize doesn't wipe what was recorded.
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
  /** Time since the newest entry was recorded. */
  let sinceEntry = 0;
  /** Time since the last level was given. */
  let sinceFed = Number.POSITIVE_INFINITY;
  /** The last level given; held when nothing new arrives before the next entry. */
  let latest = 0;
  /** The loudest level given since the newest entry. */
  let pending = 0;

  return {
    feed: (level) => {
      latest = level;
      pending = Math.max(pending, level);
      sinceFed = 0;
    },
    levels,
    get progress() {
      return sinceEntry / interval;
    },
    step: (elapsedMs) => {
      sinceFed += elapsedMs;
      if (sinceFed > stallMs) {
        return false;
      }
      sinceEntry += elapsedMs;
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
