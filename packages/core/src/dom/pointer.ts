/**
 * A mouse or pen move with no button down: the press was released where this
 * page could not see it, outside the window or over a menu, so the drag it
 * belongs to is over. A touch contact always reports a button while it moves.
 */
export function isReleased(event: { buttons: number; pointerType: string }) {
  return (
    (event.pointerType === "mouse" || event.pointerType === "pen") &&
    event.buttons === 0
  );
}
