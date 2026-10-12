import { isReleased } from "./pointer.js";

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
