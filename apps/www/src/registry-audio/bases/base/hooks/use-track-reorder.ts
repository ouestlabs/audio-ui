"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";

/** The nearest ancestor that scrolls vertically, or null for the page. */
function verticalScroller(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
  }
  return null;
}

/** How far to scroll so a pointer held near the top or bottom edge of a view keeps it going; 0 away from the edges. */
function edgeScrollStep(y: number, top: number, bottom: number): number {
  if (y < top + 48) {
    return -Math.min(24, Math.ceil((top + 48 - y) / 3));
  }
  if (y > bottom - 48) {
    return Math.min(24, Math.ceil((y - bottom + 48) / 3));
  }
  return 0;
}

/** Where a track would land: on the top or bottom edge of a row. */
export interface TrackDrop {
  edge: "bottom" | "top";
  id: string;
}

/** The line a track would land on: none when it stays where it is or one place below. */
function dropLine(
  gap: number,
  from: number,
  rows: { id: string }[]
): TrackDrop | null {
  if (gap === from || gap === from + 1) {
    return null;
  }
  if (gap < rows.length) {
    return { edge: "top", id: rows[gap].id };
  }
  return { edge: "bottom", id: rows.at(-1)?.id ?? "" };
}

/** The copy of a track's header that follows the pointer: draw it fixed, at this box, with `ref` on it. */
export interface TrackGhost {
  height: number;
  id: string;
  left: number;
  top: number;
  width: number;
}

/**
 * Reorders the tracks of a timeline: drag a track's grip to move it, or
 * press Up or Down on it. Give each grip `gripProps(id)`; it must sit inside
 * the `Timeline`, in its track's row. While a track is dragged, `drop` says
 * where it would land, and `ghost` is the copy of its header to draw under
 * the pointer: the drag moves it straight in the DOM, so a move costs no
 * render. The view scrolls when the pointer nears its top or bottom edge.
 */
export function useTrackReorder({
  onMove,
  order,
}: {
  /** A track was dropped at `index`, counted once it has left its place. */
  onMove: (id: string, index: number) => void;
  /** The tracks' ids, top to bottom. */
  order: readonly string[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<TrackDrop | null>(null);
  const [ghost, setGhost] = useState<TrackGhost | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const live = useRef({ onMove, order });
  live.current = { onMove, order };

  const startDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const id = event.currentTarget.dataset.trackGrip ?? "";
    const row = event.currentTarget.closest<HTMLElement>(
      '[data-slot="timeline-track"]'
    );
    const timeline = event.currentTarget.closest<HTMLElement>(
      '[data-slot="timeline"]'
    );
    if (!(row && timeline)) {
      return;
    }
    // Each grip spans its row's height, so its box gives the row's top and bottom.
    const rows = Array.from(
      timeline.querySelectorAll<HTMLElement>("[data-track-grip]")
    ).map((grip) => {
      const box = grip.getBoundingClientRect();
      return {
        bottom: box.bottom,
        id: grip.dataset.trackGrip ?? "",
        top: box.top,
      };
    });
    const from = rows.findIndex((item) => item.id === id);
    const box = row.getBoundingClientRect();
    // The copy is the track's header, the column the name and the controls sit in.
    const header = (
      row.querySelector<HTMLElement>('[data-slot="timeline-track-header"]') ??
      row
    ).getBoundingClientRect();
    const scroller = verticalScroller(row);
    const scrollTop = () => (scroller ? scroller.scrollTop : window.scrollY);
    const startScroll = scrollTop();
    const startY = event.clientY;
    let gap = from;
    let lastY = startY;
    let frame = 0;

    // Once a frame while the track is dragged, whether or not the pointer moved: near an edge of the scroller, it
    // scrolls; the rows are where they were at the press, moved by how far the scroller has gone since.
    const tick = () => {
      const view = scroller
        ? scroller.getBoundingClientRect()
        : { bottom: window.innerHeight, top: 0 };
      const step = edgeScrollStep(lastY, view.top, view.bottom);
      if (scroller) {
        scroller.scrollTop += step;
      } else {
        window.scrollBy(0, step);
      }
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translateY(${lastY - startY}px)`;
      }
      const shift = scrollTop() - startScroll;
      const index = rows.findIndex(
        (item) => lastY < (item.top + item.bottom) / 2 - shift
      );
      const next = index === -1 ? rows.length : index;
      if (next !== gap) {
        gap = next;
        setDrop(dropLine(gap, from, rows));
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (moveEvent: globalThis.PointerEvent) => {
      lastY = moveEvent.clientY;
    };
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", cancel);
      cancelAnimationFrame(frame);
      // The gap the track lands in; one less once the track has left a place above it.
      const landed = gap > from ? gap - 1 : gap;
      if (commit && from !== -1 && landed !== from) {
        live.current.onMove(id, landed);
      }
      setGhost(null);
      setDraggingId(null);
      setDrop(null);
    };
    const release = () => finish(true);
    const cancel = () => finish(false);

    setGhost({
      height: box.height,
      id,
      left: header.left,
      top: box.top,
      width: header.width,
    });
    setDraggingId(id);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", cancel);
    frame = requestAnimationFrame(tick);
  }, []);

  const nudge = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const id = event.currentTarget.dataset.trackGrip ?? "";
    const from = live.current.order.indexOf(id);
    const direction = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (from === -1 || !direction) {
      return;
    }
    event.preventDefault();
    live.current.onMove(id, from + direction);
  }, []);

  const gripProps = useCallback(
    (id: string) => ({
      "data-track-grip": id,
      onKeyDown: nudge,
      onPointerDown: startDrag,
    }),
    [nudge, startDrag]
  );

  return { draggingId, drop, ghost, ghostRef, gripProps };
}
