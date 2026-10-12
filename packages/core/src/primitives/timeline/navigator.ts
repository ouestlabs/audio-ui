import { followPointer } from "../../dom/gesture";
import { createChangeEventDetails } from "../../value/events";
import type { TimelineZoomChangeEventDetails } from "./position";
import type { ZoomAnchor } from "./scale";

/** How the viewport is scrolled and zoomed, as last laid out. */
export interface NavigatorMetrics {
  /** Where value 0 sits in the scrolled content, in px: past a column of headers, for instance. */
  origin: number;
  scrollStart: number;
  /** Visible width, in px. */
  width: number;
  /** px per unit as drawn: the zoom, or what fitting the width gives. */
  zoom: number;
}

/** The part of the navigator a gesture moves: one of its edges, or the window between them. */
export type NavigatorPart = "end" | "start" | "window";

/** The stretch of the timeline the viewport shows, in units. */
export function visibleRange(
  metrics: NavigatorMetrics,
  duration: number
): readonly [start: number, end: number] {
  if (!(metrics.zoom > 0 && metrics.width > 0)) {
    return [0, duration];
  }
  const start = Math.min(
    duration,
    Math.max(0, metrics.scrollStart / metrics.zoom)
  );
  const span = Math.max(0, metrics.width - metrics.origin) / metrics.zoom;
  return [start, Math.min(duration, start + span)];
}

/** Where `part` lands when moved by `delta` units from `from`, within the timeline. */
export function movedRange(
  part: NavigatorPart,
  from: readonly [number, number],
  delta: number,
  duration: number
): [number, number] {
  const [start, end] = from;
  const minSpan = duration / 1000;
  if (part === "window") {
    const span = end - start;
    const next = Math.min(Math.max(0, start + delta), duration - span);
    return [next, next + span];
  }
  if (part === "start") {
    return [Math.min(Math.max(0, start + delta), end - minSpan), end];
  }
  return [start, Math.min(Math.max(start + minSpan, end + delta), duration)];
}

/** A keypress moves the window or an edge by this share of the timeline. */
const NUDGE_SHARE = 0.02;

export interface NavigatorOptions {
  disabled?: boolean;
  duration: number;
  /** The viewport's metrics as last laid out. */
  metrics: () => NavigatorMetrics;
  /** Scrolls the viewport to `left` px. */
  scrollTo: (left: number) => void;
  /** Clamps and proposes a zoom held still around `anchor`; returns whether it was applied. */
  zoomTo: (
    next: number,
    details: TimelineZoomChangeEventDetails,
    anchor: ZoomAnchor
  ) => boolean;
}

export interface NavigatorController {
  /** Double click shows everything. */
  doubleClick: (event: MouseEvent) => void;
  /** Moves a part of the window, its edge or the window itself, by a share of the keyboard step: a key or the wheel. */
  keyDown: (part: NavigatorPart, event: KeyboardEvent) => boolean;
  /** Starts a drag of `part` from `handle`; `track` is the navigator's bar, which turns px into units. */
  press: (
    part: NavigatorPart,
    event: PointerEvent,
    handle: Element,
    track: Element | null
  ) => void;
  /** The stretch shown now. */
  range: () => readonly [number, number];
  setOptions: (options: NavigatorOptions) => void;
  /** Moves a part to a value from an input: the start or end, or the window's start. */
  typeAt: (part: NavigatorPart, value: number, event: Event) => void;
}

/**
 * The navigator's behavior: a bar with the stretch the viewport shows inside
 * it, which a drag or a key moves. A move of the window scrolls, a move of an
 * edge zooms and holds the other edge still.
 */
export function createNavigatorController(
  initial: NavigatorOptions
): NavigatorController {
  let options = initial;

  /** Scrolls or zooms the viewport so it shows `next`. */
  const showRange = (
    part: NavigatorPart,
    next: readonly [number, number],
    details: TimelineZoomChangeEventDetails
  ) => {
    const metrics = options.metrics();
    const laneWidth = Math.max(1, metrics.width - metrics.origin);
    const [start, end] = next;
    if (part === "window" || !(end > start)) {
      if (metrics.zoom > 0) {
        options.scrollTo(start * metrics.zoom);
      }
      return;
    }
    // Resizing the window is zooming: its start is held at the lane's start.
    const zoomed = options.zoomTo(laneWidth / (end - start), details, {
      offset: metrics.origin,
      value: start,
    });
    if (!zoomed && metrics.zoom > 0) {
      options.scrollTo(start * metrics.zoom);
    }
  };

  const range = () => visibleRange(options.metrics(), options.duration);

  const press: NavigatorController["press"] = (part, event, handle, track) => {
    if (options.disabled || event.button !== 0) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const from = range();
    const startX = event.clientX;
    followPointer(
      handle,
      event.pointerId,
      (move) => {
        // Units per px of the bar the drag reads on.
        const width = track?.getBoundingClientRect().width ?? 0;
        const perPixel = options.duration / Math.max(width, 1);
        const delta = (move.clientX - startX) * perPixel;
        showRange(
          part,
          movedRange(part, from, delta, options.duration),
          createChangeEventDetails("drag", move)
        );
      },
      () => undefined
    );
  };

  const keyDown: NavigatorController["keyDown"] = (part, event) => {
    if (options.disabled) {
      return false;
    }
    const nudge = options.duration * NUDGE_SHARE;
    const deltas: Record<string, number> = {
      ArrowDown: -nudge,
      ArrowLeft: -nudge,
      ArrowRight: nudge,
      ArrowUp: nudge,
      End: options.duration,
      Home: -options.duration,
      PageDown: -nudge * 5,
      PageUp: nudge * 5,
    };
    const delta = deltas[event.key];
    if (delta === undefined) {
      return false;
    }
    showRange(
      part,
      movedRange(part, range(), delta, options.duration),
      createChangeEventDetails(
        "keyboard",
        event
      ) as TimelineZoomChangeEventDetails
    );
    return true;
  };

  const typeAt: NavigatorController["typeAt"] = (part, value, event) => {
    if (options.disabled) {
      return;
    }
    const current = range();
    const from = part === "end" ? current[1] : current[0];
    showRange(
      part,
      movedRange(part, current, value - from, options.duration),
      createChangeEventDetails(
        "input-change",
        event
      ) as TimelineZoomChangeEventDetails
    );
  };

  return {
    doubleClick: (event) => {
      if (options.disabled) {
        return;
      }
      showRange(
        "end",
        [0, options.duration],
        createChangeEventDetails(
          "double-click",
          event
        ) as TimelineZoomChangeEventDetails
      );
    },
    keyDown,
    press,
    range,
    setOptions: (next) => {
      options = next;
    },
    typeAt,
  };
}
