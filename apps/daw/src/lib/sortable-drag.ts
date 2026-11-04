const LIFT_PX = 4;
const MOVE_MS = 160;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";

/** How far to scroll so a pointer held near an edge of the view keeps it going; 0 away from the edges. */
function edgeScrollStep(at: number, start: number, end: number): number {
  if (at < start + 48) {
    return -Math.min(24, Math.ceil((start + 48 - at) / 3));
  }
  if (at > end - 48) {
    return Math.min(24, Math.ceil((at - end + 48) / 3));
  }
  return 0;
}

/** Scrolls what scrolls, or the page, along the row by `step`. */
function scrollAlong(
  scroller: HTMLElement | null,
  across: boolean,
  step: number
) {
  if (!scroller) {
    window.scrollBy(across ? step : 0, across ? 0 : step);
  } else if (across) {
    scroller.scrollLeft += step;
  } else {
    scroller.scrollTop += step;
  }
}

export interface SortableDragOptions {
  /** The way the row runs. */
  axis: "x" | "y";
  /** How many items move together, from `from`: a group with its tracks. @default 1 */
  count?: number;
  /** Whether the pointer is over another place that takes the item: the row then closes up behind it. */
  elsewhere?: (x: number, y: number) => boolean;
  /** The index of the item pressed. */
  from: number;
  /** The copy that follows the pointer, fixed where the item was, if it is there yet. */
  ghost: () => HTMLElement | null;
  /** Every item of the row, in order. */
  items: readonly HTMLElement[];
  /** The drag ended: the index the items land at, counted once they have left their place, or null where they stay; and whether it was released rather than cancelled. */
  onEnd: (index: number | null, released: boolean) => void;
  /** The press became a drag. */
  onLift: () => void;
  /** What scrolls near its edges; with none, the page. */
  scroller: HTMLElement | null;
  /** Where the press was. */
  x: number;
  y: number;
}

/** Follows a press on an item until it is released: call it from `pointerdown`. */
export function startSortableDrag({
  axis,
  count = 1,
  elsewhere,
  from,
  ghost,
  items,
  onEnd,
  onLift,
  scroller,
  x: startX,
  y: startY,
}: SortableDragOptions) {
  const across = axis === "x";
  const boxes = items.map((item) => item.getBoundingClientRect());
  const startOf = (box: DOMRect) => (across ? box.left : box.top);
  const endOf = (box: DOMRect) => (across ? box.right : box.bottom);
  const scrolled = () => {
    if (scroller) {
      return across ? scroller.scrollLeft : scroller.scrollTop;
    }
    return across ? window.scrollX : window.scrollY;
  };
  const middles = boxes.map((box) => (startOf(box) + endOf(box)) / 2);
  const first = boxes[from] as DOMRect;
  const last = boxes[from + count - 1] as DOMRect;
  const next = boxes[from + count];
  const before = boxes[from - 1];
  // What the others make room for: the items and the space after them, or before them at the end of the row.
  let space = 0;
  if (next) {
    space = startOf(next) - endOf(last);
  } else if (before) {
    space = startOf(first) - endOf(before);
  }
  const size = endOf(last) - startOf(first) + space;
  const moving = items.slice(from, from + count);
  const startScroll = scrolled();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const transition = reduced ? "" : `transform ${MOVE_MS}ms ${EASING}`;
  const translate = (by: number) =>
    across ? `translateX(${by}px)` : `translateY(${by}px)`;

  let lifted = false;
  let gap = from;
  let away = false;
  let x = startX;
  let y = startY;
  let frame = 0;

  /** The others, aside for a gap: those between it and where the items were. */
  const slide = () => {
    for (const [index, item] of items.entries()) {
      let by = 0;
      if (index >= from + count && index < gap) {
        by = -size;
      } else if (index >= gap && index < from) {
        by = size;
      }
      if (index < from || index >= from + count) {
        item.style.transform = by ? translate(by) : "";
      }
    }
  };
  /** How far the items travel to reach the gap. */
  const landing = () => {
    if (gap > from) {
      return endOf(boxes[gap - 1] as DOMRect) - endOf(last);
    }
    return gap < from ? startOf(boxes[gap] as DOMRect) - startOf(first) : 0;
  };

  /** The gap a pointer at `at` points at; within the items' own place, where they are. */
  const gapAt = (at: number) => {
    const shift = scrolled() - startScroll;
    const found = middles.findIndex((middle) => at < middle - shift);
    const raw = found === -1 ? items.length : found;
    return raw >= from && raw <= from + count ? from : raw;
  };
  const pageBox = () =>
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);

  // Once a frame while dragged, whether or not the pointer moved: near an edge of the view it scrolls, and the items
  // are where they were at the press, moved by how far it has scrolled since.
  const tick = () => {
    const at = across ? x : y;
    const view = scroller?.getBoundingClientRect() ?? pageBox();
    scrollAlong(
      scroller,
      across,
      edgeScrollStep(at, startOf(view), endOf(view))
    );
    const copy = ghost();
    if (copy) {
      copy.style.transform = translate(at - (across ? startX : startY));
    }
    away = elsewhere?.(x, y) ?? false;
    const wanted = away ? from : gapAt(at);
    if (wanted !== gap) {
      gap = wanted;
      slide();
    }
    frame = requestAnimationFrame(tick);
  };

  const follow = (event: PointerEvent) => {
    x = event.clientX;
    y = event.clientY;
    if (!lifted && Math.hypot(x - startX, y - startY) >= LIFT_PX) {
      lifted = true;
      onLift();
      document.documentElement.style.cursor = "grabbing";
      for (const item of moving) {
        item.style.visibility = "hidden";
      }
      for (const item of items) {
        item.style.transition = transition;
      }
      frame = requestAnimationFrame(tick);
    }
  };

  const finish = (released: boolean) => {
    window.removeEventListener("pointermove", follow);
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", escape, { capture: true });
    cancelAnimationFrame(frame);
    if (!lifted) {
      return;
    }
    document.documentElement.style.cursor = "";
    const carried = released && away;
    if (!released) {
      gap = from;
      slide();
    }
    const clean = () => {
      for (const item of items) {
        item.style.transform = "";
        item.style.transition = "";
        item.style.visibility = "";
      }
      let index: number | null = null;
      if (released && !away && gap !== from) {
        index = gap > from ? gap - count : gap;
      }
      onEnd(index, released);
    };
    const copy = ghost();
    if (copy && !reduced && !carried) {
      const to = translate(landing() - (scrolled() - startScroll));
      copy
        .animate([{ transform: copy.style.transform }, { transform: to }], {
          duration: MOVE_MS,
          easing: EASING,
          fill: "forwards",
        })
        .finished.then(clean, clean);
    } else {
      clean();
    }
  };
  const release = () => finish(true);
  const cancel = () => finish(false);
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      cancel();
    }
  };

  window.addEventListener("pointermove", follow);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", escape, { capture: true });
}