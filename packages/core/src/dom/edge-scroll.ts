import { createFrameTask } from "./frame.ts";

/** How near an edge of a view the pointer is held, in px, for the view to scroll. */
const EDGE_PX = 48;
/** The most a view scrolls in a frame, in px: with the pointer at its edge or past it. */
const MAX_STEP_PX = 24;

/** What each axis reads: the scroll, the edges of a box, and the size of the window. */
const AXES = {
  x: ["scrollLeft", "left", "right", "innerWidth"],
  y: ["scrollTop", "top", "bottom", "innerHeight"],
} as const;

type Axis = keyof typeof AXES;

/**
 * How far a view scrolls this frame for a pointer at `at`, between its
 * visible `start` and `end`: nothing away from them, then faster the nearer
 * the pointer is held to an edge, or the further past it.
 */
export function edgeScrollStep(at: number, start: number, end: number): number {
  if (at < start + EDGE_PX) {
    return -Math.min(MAX_STEP_PX, Math.ceil((start + EDGE_PX - at) / 3));
  }
  if (at > end - EDGE_PX) {
    return Math.min(MAX_STEP_PX, Math.ceil((at - end + EDGE_PX) / 3));
  }
  return 0;
}

/** The nearest element, from `element` up, that scrolls along `axis`: one that lets it and has more to show. */
export function scrollParent(element: Element, axis: Axis): HTMLElement | null {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const overflow = axis === "x" ? style.overflowX : style.overflowY;
    if (
      node instanceof HTMLElement &&
      (overflow === "auto" || overflow === "scroll") &&
      (axis === "x"
        ? node.scrollWidth > node.clientWidth
        : node.scrollHeight > node.clientHeight)
    ) {
      return node;
    }
  }
  return null;
}

/** px on screen for each px of layout, for a view drawn scaled. */
export function screenScale(element: HTMLElement): number {
  return element.offsetWidth > 0
    ? element.getBoundingClientRect().width / element.offsetWidth
    : 1;
}

/** A view that scrolls along one axis. */
export interface EdgeScrollView {
  /** The px at the start of the view that content held there covers, such as sticky headers: its edge zone starts after them. @default 0 */
  covered?: number;
  element: HTMLElement;
}

export interface EdgeScroll {
  /** Where the pointer has moved to, in client px: call it on each move of the drag, not on the press. */
  follow: (x: number, y: number) => void;
  /** How far each view has scrolled since the drag began, in client px: add it to the pointer's travel. */
  shift: () => { x: number; y: number };
  /** The drag ended: no more scrolling. */
  stop: () => void;
}

/**
 * Scrolls the views around a drag while the pointer is held near one of their
 * edges, once a frame, so something dragged can be taken past what is on
 * screen: across a timeline wider than its window, or to a lane below it. It
 * runs on frames rather than on moves, since a pointer held still at an edge
 * is the point, and sleeps away from the edges until the pointer moves again.
 * `onScroll` runs after each frame that scrolled, for the drag to place what
 * it moves under the pointer again, `shift()` added.
 */
export function createEdgeScroll(
  views: Partial<Record<Axis, EdgeScrollView | null>>,
  onScroll: () => void
): EdgeScroll {
  const axes = (["x", "y"] as const).flatMap((axis) => {
    const view = views[axis];
    return view
      ? [
          {
            axis,
            from: view.element[AXES[axis][0]],
            scale: screenScale(view.element),
            view,
          },
        ]
      : [];
  });
  let pointer: Record<Axis, number> | null = null;

  const task = createFrameTask(() => {
    if (!pointer) {
      return false;
    }
    let scrolled = false;
    for (const { axis, scale, view } of axes) {
      const [scroll, low, high, size] = AXES[axis];
      const { element } = view;
      const box = element.getBoundingClientRect();
      // Only the part of the view on screen counts: a view taller than the window has its edge off screen.
      const start = Math.max(box[low], 0) + (view.covered ?? 0);
      const end = Math.max(start, Math.min(box[high], window[size]));
      const before = element[scroll];
      element[scroll] += edgeScrollStep(pointer[axis], start, end) / scale;
      scrolled ||= element[scroll] !== before;
    }
    if (scrolled) {
      onScroll();
    }
    // Away from the edges, or at the end of what there is to show, it sleeps until the pointer moves.
    return scrolled;
  });

  return {
    follow: (x, y) => {
      pointer = { x, y };
      task.wake();
    },
    shift: () => {
      const travel = { x: 0, y: 0 };
      for (const { axis, from, scale, view } of axes) {
        travel[axis] = (view.element[AXES[axis][0]] - from) * scale;
      }
      return travel;
    },
    stop: () => {
      pointer = null;
      task.stop();
    },
  };
}
