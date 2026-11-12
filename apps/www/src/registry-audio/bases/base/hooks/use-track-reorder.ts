import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { startSortableDrag } from "@/registry-audio/bases/base/lib/sortable-drag";

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
 * the `Timeline`, in its track's row. While a track is dragged the other rows
 * slide aside for it, and `ghost` is the copy of its header to draw under the
 * pointer: the drag moves them straight in the DOM, so a move costs no render.
 * The view scrolls when the pointer nears its top or bottom edge.
 */
export function useTrackReorder({
  blockOf,
  onMove,
  order,
}: {
  /** The tracks that move with a track, itself first: a group with what is in it. @default the track alone */
  blockOf?: (id: string) => readonly string[];
  /** A track was dropped at `index`, counted once it has left its place. */
  onMove: (id: string, index: number) => void;
  /** The tracks' ids, top to bottom. */
  order: readonly string[];
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<TrackGhost | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const live = useRef({ blockOf, onMove, order });
  live.current = { blockOf, onMove, order };

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
    const grips = Array.from(
      timeline.querySelectorAll<HTMLElement>("[data-track-grip]")
    );
    const items = grips.flatMap((grip) => {
      const own = grip.closest<HTMLElement>('[data-slot="timeline-track"]');
      return own ? [own] : [];
    });
    const from = items.indexOf(row);
    const block = new Set(live.current.blockOf?.(id) ?? [id]);
    const count = grips.filter((grip) =>
      block.has(grip.dataset.trackGrip ?? "")
    ).length;
    const box = row.getBoundingClientRect();
    // The copy is the track's header, the column the name and the controls sit in.
    const header = (
      row.querySelector<HTMLElement>('[data-slot="timeline-track-header"]') ??
      row
    ).getBoundingClientRect();
    startSortableDrag({
      axis: "y",
      count: Math.max(count, 1),
      from,
      ghost: () => ghostRef.current,
      items,
      // In the frame the copy goes, the new order is there: one without either would jump.
      onEnd: (landed) =>
        flushSync(() => {
          setGhost(null);
          setDraggingId(null);
          if (landed !== null) {
            live.current.onMove(id, landed);
          }
        }),
      onLift: () => {
        setGhost({
          height: box.height,
          id,
          left: header.left,
          top: box.top,
          width: header.width,
        });
        setDraggingId(id);
      },
      scroller: verticalScroller(row),
      x: event.clientX,
      y: event.clientY,
    });
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

  return { draggingId, ghost, ghostRef, gripProps };
}
