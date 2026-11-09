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

/** A touch pointer event at `x`, `y`, from finger `pointerId`. */
export function touch(type: string, x: number, y: number, pointerId: number) {
  return new PointerEvent(type, {
    bubbles: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: x,
    clientY: y,
    pointerId,
    pointerType: "touch",
  });
}

/** An element in the page, `width` by `height` px at the origin. */
export function boxElement(width = 160, height = 50) {
  const element = document.createElement("div");
  document.body.append(element);
  element.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
    }) as DOMRect;
  return element;
}

type At = readonly [x: number, y: number];

/**
 * One finger drags a control, a second one presses, moves and lifts on it,
 * then the first goes on and lifts: the second must change nothing, and the
 * first drag must go on to commit once.
 */
export function dragWithSecondFinger({
  changes,
  commits,
  first,
  press,
  second,
}: {
  /** How many changes the control has reported so far. */
  changes: () => number;
  /** How many commits the control has reported so far. */
  commits: () => number;
  /** Where the first finger presses, then moves, then moves again. */
  first: readonly [At, At, At];
  /** Starts a press on the control, as its view does on `pointerdown`. */
  press: (event: PointerEvent) => void;
  /** Where the second finger presses, then moves. */
  second: readonly [At, At];
}) {
  const [down, move, again] = first;
  press(touch("pointerdown", ...down, 1));
  document.dispatchEvent(touch("pointermove", ...move, 1));
  const before = changes();
  press(touch("pointerdown", ...second[0], 2));
  document.dispatchEvent(touch("pointermove", ...second[1], 2));
  document.dispatchEvent(touch("pointerup", ...second[1], 2));
  const byTheSecond = changes() - before;
  const committedEarly = commits();
  document.dispatchEvent(touch("pointermove", ...again, 1));
  const followedAfter = changes() > before;
  document.dispatchEvent(touch("pointerup", ...again, 1));
  return { byTheSecond, committedEarly, commits: commits(), followedAfter };
}

/** What `dragWithSecondFinger` finds when only the first finger counts. */
export const ONE_FINGER = {
  byTheSecond: 0,
  committedEarly: 0,
  commits: 1,
  followedAfter: true,
};
