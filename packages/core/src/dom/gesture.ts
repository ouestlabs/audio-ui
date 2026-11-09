import { isReleased } from "./pointer.ts";

/**
 * Follows one pointer on its document until it is released or cancelled:
 * `move` gets each move of that pointer, and `end` gets the release or the
 * cancel. Both listeners go when the gesture ends, through one signal.
 */
export function followPointer(
  target: Element,
  pointerId: number,
  move: (event: PointerEvent) => void,
  end: (event: PointerEvent) => void
): void {
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
}

/** One pointer at a time on a control, as `createPointerLock` makes it. */
export interface PointerLock {
  /** Whether a press is to be ignored: another pointer drags the control. */
  busy: (event: PointerEvent) => boolean;
  /** Follows one pointer as `followPointer` does, and holds the control until it ends. */
  follow: typeof followPointer;
}

/**
 * One pointer at a time on a control: while one drags it, a press from
 * another is ignored, so a second finger can't take the gesture over. The
 * same pointer pressing again means its release was missed: that press
 * starts afresh, so a lost release never leaves the control dead.
 */
export function createPointerLock(): PointerLock {
  let held: number | null = null;
  return {
    busy: (event) => held !== null && held !== event.pointerId,
    follow: (target, pointerId, move, end) => {
      held = pointerId;
      followPointer(target, pointerId, move, (event) => {
        held = null;
        end(event);
      });
    },
  };
}
