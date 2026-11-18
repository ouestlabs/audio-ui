import { type PointerEvent, useCallback, useState } from "react";

/** A stretch of time with nothing in it, as `[from, to]` in the timeline's units. */
export type Pause = readonly [number, number];

/**
 * The pause the pointer is over on a lane, to draw as a zone while it is
 * there. Give the lane's `onPointerMove` and `onPointerLeave` to its props, and
 * the `zoom` it is drawn at, in pixels per unit: the pointer's position is read
 * against the lane's own box. Nothing is under the pointer while a button is
 * held, as in a drag.
 */
export function useSilenceHover({
  pauses,
  zoom,
}: {
  pauses: readonly Pause[];
  zoom: number;
}) {
  const [pause, setPause] = useState<Pause | null>(null);
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!zoom || event.buttons !== 0) {
        setPause(null);
        return;
      }
      const box = event.currentTarget.getBoundingClientRect();
      const at = (event.clientX - box.left) / zoom;
      const found = pauses.find(([from, to]) => at >= from && at <= to) ?? null;
      setPause((current) =>
        current?.[0] === found?.[0] && current?.[1] === found?.[1]
          ? current
          : found
      );
    },
    [pauses, zoom]
  );
  const onPointerLeave = useCallback(() => setPause(null), []);
  return { onPointerLeave, onPointerMove, pause };
}
