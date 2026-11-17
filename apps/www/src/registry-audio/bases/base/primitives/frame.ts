/**
 * Painting outside any render: a task that runs on animation frames only
 * while it has something to animate, and a watch on whether an element is in
 * view. Shared by the waveform and the timeline.
 */

/** The longest step the clock takes, so a task that slept or sat in a hidden tab never jumps ahead. */
const MAX_STEP_MS = 100;

/** What `createFrameTask` returns: wake it when something moves, flush it to step at once, stop it for good. */
export interface FrameTask {
  /** Run a step now, without waiting for the pending frame. */
  flush: () => void;
  /** Stop for good: a stopped task ignores `wake` and `flush`. */
  stop: () => void;
  /** Run a step on the next animation frame, unless one is already pending. */
  wake: () => void;
}

/**
 * Runs `step` on animation frames for as long as it returns true, and sleeps
 * otherwise: a painter with nothing left to animate costs no frames until it
 * is woken. `step` receives the time since the previous step, in milliseconds:
 * zero on the first step after a sleep, and never more than 100.
 */
export function createFrameTask(
  step: (elapsedMs: number) => boolean
): FrameTask {
  let frame = 0;
  let lastMs: number | null = null;
  let stopped = false;

  const wake = () => {
    if (!stopped && frame === 0) {
      frame = requestAnimationFrame(run);
    }
  };

  function run(nowMs: number) {
    frame = 0;
    const elapsed =
      lastMs === null ? 0 : Math.min(Math.max(0, nowMs - lastMs), MAX_STEP_MS);
    lastMs = nowMs;
    if (step(elapsed)) {
      wake();
    } else {
      lastMs = null;
    }
  }

  return {
    flush: () => {
      if (stopped) {
        return;
      }
      cancelAnimationFrame(frame);
      run(performance.now());
    },
    stop: () => {
      stopped = true;
      cancelAnimationFrame(frame);
      frame = 0;
    },
    wake,
  };
}

/**
 * Calls `onChange` when `element` enters or leaves the viewport, so a painter
 * can skip frames nobody sees. Returns a function that stops observing.
 */
export function observeVisibility(
  element: Element,
  onChange: (visible: boolean) => void
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    return () => undefined;
  }
  const observer = new IntersectionObserver((entries) => {
    const entry = entries.at(-1);
    if (entry) {
      onChange(entry.isIntersecting);
    }
  });
  observer.observe(element);
  return () => observer.disconnect();
}
