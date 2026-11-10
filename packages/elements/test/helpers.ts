/** happy-dom returns an all-zero rect; a test of pointer geometry pins one. */
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

/** A pointer event of the primary button, bubbling, as a mouse sends it. */
export function pointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: PointerEventInit
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      cancelable: true,
      ...init,
    })
  );
}

/** A key pressed on `target`, bubbling and cancelable. */
export function key(
  target: Element,
  name: string,
  init: KeyboardEventInit = {}
) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: name,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** What the `input` and `change` events of a control reported, in order. */
export function listen(element: Element) {
  const changes: [number, string][] = [];
  const commits: [number, string][] = [];
  element.addEventListener("input", (event) => {
    const { detail } = event as CustomEvent<{ reason: string; value: number }>;
    changes.push([detail.value, detail.reason]);
  });
  element.addEventListener("change", (event) => {
    const { detail } = event as CustomEvent<{ reason: string; value: number }>;
    commits.push([detail.value, detail.reason]);
  });
  return { changes, commits };
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
    restore() {
      globalThis.requestAnimationFrame = original.request;
      globalThis.cancelAnimationFrame = original.cancel;
      performance.now = original.now;
    },
  };
}
