import { createPointerLock } from "../../dom/gesture.ts";
import { createChangeEventDetails } from "../../value/events.ts";
import type { TimelineZoomChangeEventDetails } from "./position.ts";
import type { ZoomAnchor } from "./scale.ts";

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

/**
 * How wide the window is drawn, in px, for a stretch `width` px of a bar `bar`
 * px wide. It meets the bar's whole width at the top and `least` at the bottom,
 * and every width has its own, so a window dragged to a width shows just one
 * stretch: a tiny stretch keeps the window big enough to hold, with no step.
 */
function drawnWidth(width: number, bar: number, least: number): number {
  if (least <= 0) {
    return width;
  }
  const floor = Math.min(least, bar / 2);
  return Math.sqrt(width ** 2 + floor ** 2 * (1 - (width / bar) ** 2));
}

/**
 * The window as it is drawn on a bar `bar` px wide, its two edges in px, for
 * the stretch `range`: never narrower than `least`, and inside the bar, at the
 * end of the timeline too. With no `least`, it is the stretch itself.
 */
export function thumbOf(
  range: readonly [number, number],
  duration: number,
  bar: number,
  least: number
): [number, number] {
  const perUnit = bar / duration;
  const width = (range[1] - range[0]) * perUnit;
  const drawn = drawnWidth(width, bar, least);
  const room = bar - width;
  const from = room > 0 ? (range[0] * perUnit * (bar - drawn)) / room : 0;
  return [from, from + drawn];
}

/** The stretch a window drawn from `thumb[0]` to `thumb[1]` px shows: `thumbOf` read back. */
export function rangeOfThumb(
  thumb: readonly [number, number],
  duration: number,
  bar: number,
  least: number
): [number, number] {
  const drawn = thumb[1] - thumb[0];
  const floor = Math.min(least, bar / 2);
  const width =
    least > 0
      ? Math.sqrt(
          Math.max(0, (drawn ** 2 - floor ** 2) / (1 - (floor / bar) ** 2))
        )
      : drawn;
  const room = bar - drawn;
  const from = room > 0 ? (thumb[0] * (bar - width)) / room : 0;
  const perUnit = bar / duration;
  return [from / perUnit, (from + width) / perUnit];
}

/** Where a drag of `part` by `delta` px leaves the window: an edge stops at `least` wide, the other held still. */
function movedThumb(
  part: NavigatorPart,
  [from, to]: readonly [number, number],
  delta: number,
  bar: number,
  least: number
): [number, number] {
  if (part === "window") {
    const next = Math.min(Math.max(0, from + delta), bar - (to - from));
    return [next, next + (to - from)];
  }
  if (part === "start") {
    return [Math.max(0, Math.min(from + delta, to - least)), to];
  }
  return [from, Math.min(Math.max(from + least, to + delta), bar)];
}

/** A keypress moves the window or an edge by this share of the timeline. */
const NUDGE_SHARE = 0.02;

/** The options of `createNavigatorController`: the timeline's length, how the viewport is laid out, the functions that scroll and zoom it, and the narrowest the window may be. */
export interface NavigatorOptions {
  disabled?: boolean;
  duration: number;
  /** The closest the viewport zooms, in px per unit: a drag of an edge stops there, the window with it, rather than sliding on. */
  maxZoom?: number;
  /** The viewport's metrics as last laid out. */
  metrics: () => NavigatorMetrics;
  /** The least width the window is drawn at, in px: a drag follows the window as drawn. @default 0 */
  minWindowWidth?: number;
  /** Scrolls the viewport to `left` px. */
  scrollTo: (left: number) => void;
  /** Clamps and proposes a zoom held still around `anchor`; returns whether it was applied. */
  zoomTo: (
    next: number,
    details: TimelineZoomChangeEventDetails,
    anchor: ZoomAnchor
  ) => boolean;
}

/** What `createNavigatorController` returns: the stretch the window shows, and the presses, keys, typed values and double click that move it. */
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
  const pointers = createPointerLock();

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
    if (options.disabled || event.button !== 0 || !pointers.claim(event)) {
      return;
    }
    handle.setPointerCapture?.(event.pointerId);
    const from = range();
    const startX = event.clientX;
    pointers.follow(
      handle,
      event.pointerId,
      (move) => {
        // The window follows the pointer on the bar, and what the view shows follows the window.
        const { duration, maxZoom, minWindowWidth = 0 } = options;
        const bar = Math.max(track?.getBoundingClientRect().width ?? 0, 1);
        const metrics = options.metrics();
        const lane = Math.max(1, metrics.width - metrics.origin);
        const leastSpan = Math.max(
          duration / 1000,
          maxZoom ? lane / maxZoom : 0
        );
        const next = movedThumb(
          part,
          thumbOf(from, duration, bar, minWindowWidth),
          move.clientX - startX,
          bar,
          drawnWidth((leastSpan / duration) * bar, bar, minWindowWidth)
        );
        showRange(
          part,
          rangeOfThumb(next, duration, bar, minWindowWidth),
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
