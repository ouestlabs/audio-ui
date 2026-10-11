/**
 * Undo and redo as a value: every function takes the present and hands back
 * the present, and holds no state of its own. A component keeps the history in
 * a ref and the document in state; two undos in one tick are then fed the
 * first one's result instead of reading the same stale stack twice, applying
 * the same entry both times and dropping the older one.
 */

export interface History<T> {
  readonly future: readonly T[];
  readonly past: readonly T[];
  /**
   * What the document was before a burst of changes that has not settled, or
   * null between bursts. A drag reports every tick and only the value from
   * before the first is worth keeping; until the burst settles it is not on
   * `past`, but it is still the latest change, so undo reaches it here.
   */
  readonly pending: T | null;
}

export interface HistoryStep<T> {
  readonly history: History<T>;
  readonly present: T;
}

/** How many entries a history keeps: deep, not infinite. */
export const HISTORY_LIMIT = 100;

export function emptyHistory<T>(): History<T> {
  return { future: [], past: [], pending: null };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.pending !== null || history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

/**
 * Opens a burst, or joins the one already open. Redo goes with it: a new
 * change makes the branch redo was holding unreachable.
 */
export function beginChange<T>(history: History<T>, present: T): History<T> {
  return {
    future: [],
    past: history.past,
    pending: history.pending ?? present,
  };
}

/** Closes a burst: everything it did becomes one entry on `past`. */
export function settleChange<T>(
  history: History<T>,
  limit = HISTORY_LIMIT
): History<T> {
  if (history.pending === null) {
    return history;
  }
  return {
    future: history.future,
    past: [...history.past, history.pending].slice(-limit),
    pending: null,
  };
}

/** A change made in one go: a burst opened and closed. */
export function recordChange<T>(
  history: History<T>,
  present: T,
  limit = HISTORY_LIMIT
): History<T> {
  return settleChange(beginChange(history, present), limit);
}

/** Takes back the latest change, or returns null when there is none. */
export function undo<T>(
  history: History<T>,
  present: T
): HistoryStep<T> | null {
  // An unsettled burst is still the latest change: undo right after a click
  // must revert that click, not the one before it.
  if (history.pending !== null) {
    return {
      history: {
        future: [...history.future, present],
        past: history.past,
        pending: null,
      },
      present: history.pending,
    };
  }
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return null;
  }
  return {
    history: {
      future: [...history.future, present],
      past: history.past.slice(0, -1),
      pending: null,
    },
    present: previous,
  };
}

/** Puts back what undo took, or returns null when there is nothing to put back. */
export function redo<T>(
  history: History<T>,
  present: T,
  limit = HISTORY_LIMIT
): HistoryStep<T> | null {
  const next = history.future.at(-1);
  if (next === undefined) {
    return null;
  }
  return {
    history: {
      future: history.future.slice(0, -1),
      past: [...history.past, present].slice(-limit),
      pending: history.pending,
    },
    present: next,
  };
}
