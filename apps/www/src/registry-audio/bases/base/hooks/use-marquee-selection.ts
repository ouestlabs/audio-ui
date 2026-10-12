"use client";

import { type PointerEvent, useCallback, useRef, useState } from "react";

export interface Marquee {
  height: number;
  left: number;
  top: number;
  width: number;
}

/** Whether two rectangles overlap. */
const overlaps = (a: DOMRect, b: Marquee) =>
  a.left < b.left + b.width &&
  a.right > b.left &&
  a.top < b.top + b.height &&
  a.bottom > b.top;

/**
 * A marquee for the clips: Shift and drag across bare lane draws a rectangle,
 * and the clips it touches join the selection. It is told of the selection
 * when the drag began, to add to it, and of the clips it touches as it grows.
 */
export function useMarquee(
  initial: string[],
  onSelect: (clips: string[]) => void,
  multi: boolean
) {
  const [rect, setRect] = useState<Marquee | null>(null);
  const start = useRef<{ x: number; y: number; chosen: string[] } | null>(null);

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const bare =
        event.target instanceof Element &&
        event.target.hasAttribute("data-timeline-lane");
      if (!((event.shiftKey || multi) && event.button === 0 && bare)) {
        return;
      }
      // The lane would take this press for the cursor: it is a marquee instead.
      event.stopPropagation();
      // And no text should be selected as it is dragged over.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { chosen: initial, x: event.clientX, y: event.clientY };
    },
    [initial, multi]
  );
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const origin = start.current;
      if (!origin) {
        return;
      }
      const next = {
        height: Math.abs(event.clientY - origin.y),
        left: Math.min(event.clientX, origin.x),
        top: Math.min(event.clientY, origin.y),
        width: Math.abs(event.clientX - origin.x),
      };
      setRect(next);
      const touched = [
        ...event.currentTarget.querySelectorAll<HTMLElement>("[data-clip-id]"),
      ]
        .filter((clip) => overlaps(clip.getBoundingClientRect(), next))
        .map((clip) => clip.getAttribute("data-clip-id") ?? "");
      onSelect([...new Set([...origin.chosen, ...touched])]);
    },
    [onSelect]
  );
  const onPointerEnd = useCallback(() => {
    start.current = null;
    setRect(null);
  }, []);

  return {
    handlers: {
      onLostPointerCapture: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onPointerDownCapture,
      onPointerMove,
      onPointerUp: onPointerEnd,
    },
    rect,
  };
}
