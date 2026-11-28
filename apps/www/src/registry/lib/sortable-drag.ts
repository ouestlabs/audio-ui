import { bindDrag, createAutoScroll } from "@ui-sdk/core";

/**
 * The gesture of reordering a row of items by dragging one: past a few px the
 * items lift, the others slide aside and the items show dimmed where they
 * would land, and on release what follows the pointer settles there before the
 * new order is applied. All of it goes straight in the DOM: a drag costs no
 * render. ui-sdk follows the pointer and scrolls near the edges.
 */

/** How far a press travels before it is a drag, in px: under that it stays a press. */
const LIFT_PX = 4;
const MOVE_MS = 160;
const EASING = "cubic-bezier(0.2, 0, 0, 1)";
/** How the items show where they would land. */
const DIMMED = "0.3";

export interface SortableDragOptions {
  /** The way the row runs. */
  axis: "x" | "y";
  /** How many items move together, from `from`: a group with its tracks. @default 1 */
  count?: number;
  /** Whether the pointer is over another place that takes the item: the row then closes up behind it. */
  elsewhere?: (x: number, y: number) => boolean;
  /** The press, a `pointerdown` of the primary button: in React, `event.nativeEvent`. */
  event: PointerEvent;
  /** Whether what follows the pointer goes anywhere it goes and fades as it lands, a label smaller than the item, rather than along the row. */
  free?: boolean;
  /** The index of the item pressed. */
  from: number;
  /** What follows the pointer, fixed where it starts, if it is there yet. */
  ghost: () => HTMLElement | null;
  /** Every item of the row, in order. */
  items: readonly HTMLElement[];
  /** The drag ended: the index the items land at, counted once they have left their place, or null where they stay; and whether it was released rather than cancelled. */
  onEnd: (index: number | null, released: boolean) => void;
  /** The press became a drag. */
  onLift: () => void;
  /** What scrolls near its edges; with none, what is under the pointer, then the page. */
  scroller: HTMLElement | null;
}

/** Follows a press on an item until it is released: call it from `pointerdown`. */
export function startSortableDrag({
  axis,
  count = 1,
  elsewhere,
  event: down,
  free = false,
  from,
  ghost,
  items,
  onEnd,
  onLift,
  scroller,
}: SortableDragOptions) {
  const startX = down.clientX;
  const startY = down.clientY;
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
  const transition = reduced
    ? ""
    : `transform ${MOVE_MS}ms ${EASING}, opacity ${MOVE_MS}ms ${EASING}`;
  const translate = (by: number) =>
    across ? `translateX(${by}px)` : `translateY(${by}px)`;

  let lifted = false;
  let gap = from;
  let away = false;
  let x = startX;
  let y = startY;

  /** How far the items travel to reach the gap. */
  const landing = () => {
    if (gap > from) {
      return endOf(boxes[gap - 1] as DOMRect) - endOf(last);
    }
    return gap < from ? startOf(boxes[gap] as DOMRect) - startOf(first) : 0;
  };
  /** How far an item goes for the gap: the items to it, those between it and where they were aside. */
  const offsetOf = (index: number) => {
    if (index >= from && index < from + count) {
      return landing();
    }
    if (index >= from + count && index < gap) {
      return -size;
    }
    return index >= gap && index < from ? size : 0;
  };
  const slide = () => {
    for (const [index, item] of items.entries()) {
      const by = offsetOf(index);
      item.style.transform = by ? translate(by) : "";
    }
  };

  /** The gap a pointer at `at` points at; within the items' own place, where they are. */
  const gapAt = (at: number) => {
    const shift = scrolled() - startScroll;
    const found = middles.findIndex((middle) => at < middle - shift);
    const raw = found === -1 ? items.length : found;
    return raw >= from && raw <= from + count ? from : raw;
  };
  // On each move, and on each scroll under a pointer that stays: the items are where they were at the press, moved by
  // how far the row has scrolled since.
  const update = () => {
    const at = across ? x : y;
    const copy = ghost();
    if (copy) {
      copy.style.transform = free
        ? `translate(${x - startX}px, ${y - startY}px)`
        : translate(at - (across ? startX : startY));
    }
    away = elsewhere?.(x, y) ?? false;
    const wanted = away ? from : gapAt(at);
    if (wanted !== gap) {
      gap = wanted;
      slide();
    }
  };

  const autoScroll = createAutoScroll({
    edge: 48,
    ignore: ghost,
    speed: 24,
  });
  /** Scrolls toward the pointer: along a scroller of its own, one held past an end still does, and only along the row. */
  const scrollToward = () => {
    if (!scroller) {
      autoScroll.update(x, y);
      return;
    }
    const { bottom, left, right, top } = scroller.getBoundingClientRect();
    const within = (value: number, start: number, end: number) =>
      Math.min(Math.max(value, start + 1), end - 1);
    autoScroll.update(
      across ? within(x, left, right) : (left + right) / 2,
      across ? (top + bottom) / 2 : within(y, top, bottom)
    );
  };

  /** What follows the pointer, to where the items land: a label goes to their corner and fades into them. */
  const settling = (copy: HTMLElement): Keyframe[] => {
    const shift = landing() - (scrolled() - startScroll);
    const { transform } = copy.style;
    if (!free) {
      return [{ transform }, { transform: translate(shift) }];
    }
    const box = copy.getBoundingClientRect();
    const toX = first.left + (across ? shift : 0) - box.left + x - startX;
    const toY = first.top + (across ? 0 : shift) - box.top + y - startY;
    return [
      { opacity: 1, transform },
      { opacity: 0, transform: `translate(${toX}px, ${toY}px)` },
    ];
  };

  const lift = () => {
    lifted = true;
    onLift();
    document.documentElement.style.cursor = "grabbing";
    for (const item of items) {
      item.style.transition = transition;
    }
    for (const item of moving) {
      item.style.opacity = DIMMED;
      item.style.pointerEvents = "none";
    }
    window.addEventListener("scroll", update, true);
  };

  const finish = (released: boolean) => {
    autoScroll.stop();
    window.removeEventListener("scroll", update, true);
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
        item.style.opacity = "";
        item.style.pointerEvents = "";
      }
      let index: number | null = null;
      if (released && !away && gap !== from) {
        index = gap > from ? gap - count : gap;
      }
      onEnd(index, released);
    };
    const copy = ghost();
    if (!copy || reduced || carried) {
      clean();
      return;
    }
    for (const item of moving) {
      item.style.opacity = "";
    }
    copy
      .animate(settling(copy), {
        duration: MOVE_MS,
        easing: EASING,
        fill: "forwards",
      })
      .finished.then(clean, clean);
  };

  const pressed = items[from];
  if (!pressed) {
    return;
  }
  bindDrag(pressed, down, {
    cancelOnEscape: true,
    onEnd: (_event, canceled) => finish(!canceled),
    onMove: (sample) => {
      ({ x, y } = sample);
      update();
      scrollToward();
    },
    onStart: lift,
    threshold: LIFT_PX,
  });
}
