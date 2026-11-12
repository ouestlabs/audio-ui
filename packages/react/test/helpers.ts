/** happy-dom returns an all-zero rect; tests that exercise pointer geometry pin one explicitly. */
export function mockRect(element: Element, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () =>
    ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      toJSON: () => ({}),
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      ...rect,
    }) as DOMRect;
}

/**
 * Replaces requestAnimationFrame and the clock with hand-cranked ones, so a
 * test decides when frames run and what time it is: `performance.now()`
 * reports the time of the last frame fired, starting at 0. Call `restore()`
 * when done.
 */
export function installFrames() {
  const original = {
    cancel: globalThis.cancelAnimationFrame,
    now: performance.now,
    request: globalThis.requestAnimationFrame,
  };
  let nextId = 1;
  let now = 0;
  const pending = new Map<number, FrameRequestCallback>();
  globalThis.requestAnimationFrame = (callback) => {
    pending.set(nextId, callback);
    nextId += 1;
    return nextId - 1;
  };
  globalThis.cancelAnimationFrame = (id) => {
    pending.delete(id);
  };
  performance.now = () => now;
  return {
    /** Runs the frames requested so far, at `nowMs`. */
    fire(nowMs: number) {
      now = nowMs;
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) {
        callback(nowMs);
      }
    },
    pendingCount: () => pending.size,
    restore() {
      globalThis.requestAnimationFrame = original.request;
      globalThis.cancelAnimationFrame = original.cancel;
      performance.now = original.now;
    },
  };
}
