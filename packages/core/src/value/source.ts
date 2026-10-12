/**
 * A value that changes outside React, in the shape `useSyncExternalStore`
 * expects: `subscribe` registers a listener called on each change, and
 * `getSnapshot` returns the current value. It is what a primitive's `source`
 * reads from, so that following a signal costs no React render.
 */
export interface Source<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}

export interface WritableSource<T> extends Source<T> {
  /** Publish a value. Subscribers are told every time, so the same array, updated in place, can be published again. */
  set: (value: T) => void;
}

/**
 * Creates a source you push to yourself, from an audio callback, a WebSocket,
 * a worker or a test: call `set` with each new reading, and whatever reads
 * the source follows.
 */
export function createSource<T>(initial: T): WritableSource<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    set: (next) => {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
