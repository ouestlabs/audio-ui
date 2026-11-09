import { isReleased } from "./pointer.ts";

/**
 * Follows one pointer on its document until it is released or cancelled:
 * `move` gets each move of that pointer, and `end` gets the release or the
 * cancel. Both listeners go when the gesture ends, through one signal, or
 * when the function it returns is called.
 */
export function followPointer(
  target: Element,
  pointerId: number,
  move: (event: PointerEvent) => void,
  end: (event: PointerEvent) => void
): () => void {
  const drag = new AbortController();
  const { signal } = drag;
  const doc = target.ownerDocument;
  doc.addEventListener(
    "pointermove",
    (event: PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return;
      }
      if (isReleased(event)) {
        drag.abort();
        end(event);
        return;
      }
      move(event);
    },
    { signal }
  );
  const release = (event: PointerEvent) => {
    if (event.pointerId === pointerId) {
      drag.abort();
      end(event);
    }
  };
  doc.addEventListener("pointerup", release, { signal });
  doc.addEventListener("pointercancel", release, { signal });
  return () => drag.abort();
}

/** One pointer at a time on a control, as `createPointerLock` makes it. */
export interface PointerLock {
  /**
   * Whether a press may go on: false while another pointer drags the
   * control. Call it before the press changes anything: when the same pointer
   * presses again, its release was missed, and the drag it left ends here.
   */
  claim: (event: PointerEvent) => boolean;
  /** Follows one pointer as `followPointer` does, and holds the control until it ends. */
  follow: typeof followPointer;
}

/**
 * One pointer at a time on a control: while one drags it, a press from
 * another is ignored, so a second finger can't take the gesture over. The
 * same pointer pressing again means its release was missed: the drag it left
 * ends with that press, its listeners gone, then the press starts afresh, so
 * a lost release never leaves the control dead or followed twice.
 */
export function createPointerLock(): PointerLock {
  let held: {
    end: (event: PointerEvent) => void;
    pointerId: number;
    stop: () => void;
  } | null = null;
  return {
    claim: (event) => {
      if (!held) {
        return true;
      }
      if (held.pointerId !== event.pointerId) {
        return false;
      }
      const stale = held;
      held = null;
      stale.stop();
      stale.end(event);
      return true;
    },
    follow: (target, pointerId, move, end) => {
      const stop = followPointer(target, pointerId, move, (event) => {
        if (held?.stop === stop) {
          held = null;
        }
        end(event);
      });
      held = { end, pointerId, stop };
      return stop;
    },
  };
}
