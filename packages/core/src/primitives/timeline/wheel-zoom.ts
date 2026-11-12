import { createChangeEventDetails } from "../../value/events.ts";
import type { TimelineZoomChangeEventDetails } from "./position.ts";
import { valueAtOffset } from "./scale.ts";

/**
 * How far one pixel of wheel delta zooms, as an exponent. A trackpad's pinch
 * comes as the wheel with Ctrl, about -100 ln s of delta for a spread of s:
 * the zoom goes by s², so a few pinches go from a whole timeline to its finest.
 */
export const WHEEL_ZOOM_SENSITIVITY = 0.02;

/** The most one frame zooms by, as an exponent: twice in or half out, so a mouse's notch never jumps further. */
const MOST_PER_FRAME = Math.LN2;

/** Pixels in a line and a page of wheel delta, for a wheel that counts in those. */
const DELTA_PX = [1, 16, 400] as const;

/** The options of `createWheelZoom`: the timeline's length, the zoom as drawn, where its start sits, and the function that applies a zoom. */
export interface WheelZoomOptions {
  disabled?: boolean;
  /** px per unit as drawn: the zoom, or what fitting the width gives. */
  drawnZoom: () => number;
  duration: number;
  /** Where value 0 sits in the scrolled content, in px. */
  origin: () => number;
  /** Clamps and proposes a zoom held still around the anchor; returns whether it was applied. */
  zoomTo: (
    next: number,
    details: TimelineZoomChangeEventDetails,
    anchor: { offset: number; value: number }
  ) => boolean;
}

/** What `createWheelZoom` returns: the wheel handler, `setOptions`, and `dispose`. */
export interface WheelZoomController {
  /** Drops the zoom that waits for the next frame. */
  dispose: () => void;
  setOptions: (options: WheelZoomOptions) => void;
  /** Takes a wheel event over the viewport: Cmd/Ctrl zooms, a bare wheel is left to scroll. Returns `true` when it zooms. */
  wheel: (event: WheelEvent, element: HTMLElement) => boolean;
}

/**
 * A wheel zoom around the pointer. A trackpad sends wheel events faster than
 * frames, and each zoom lays the whole timeline out again: the deltas, in
 * pixels whatever the wheel counts in, are added up and applied once per
 * frame, anchored on where the pointer was.
 */
export function createWheelZoom(
  initial: WheelZoomOptions
): WheelZoomController {
  let options = initial;
  let pending: {
    delta: number;
    event: WheelEvent;
    element: HTMLElement;
  } | null = null;
  let frame = 0;

  const flush = () => {
    frame = 0;
    const batch = pending;
    pending = null;
    if (!batch) {
      return;
    }
    const current = options.drawnZoom();
    if (!(current > 0)) {
      return;
    }
    const { element, event } = batch;
    const offset = event.clientX - element.getBoundingClientRect().left;
    const value = valueAtOffset(
      offset,
      element.scrollLeft,
      current,
      options.origin()
    );
    const exponent = Math.min(
      MOST_PER_FRAME,
      Math.max(-MOST_PER_FRAME, -batch.delta * WHEEL_ZOOM_SENSITIVITY)
    );
    options.zoomTo(
      current * Math.exp(exponent),
      createChangeEventDetails(
        "wheel",
        event
      ) as TimelineZoomChangeEventDetails,
      { offset, value: Math.min(options.duration, Math.max(0, value)) }
    );
  };

  return {
    dispose: () => {
      cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
    },
    setOptions: (next) => {
      options = next;
    },
    wheel: (event, element) => {
      if (!(event.ctrlKey || event.metaKey) || options.disabled) {
        return false;
      }
      event.preventDefault();
      pending = {
        delta:
          (pending?.delta ?? 0) +
          event.deltaY * (DELTA_PX[event.deltaMode] ?? 1),
        element,
        event,
      };
      if (!frame) {
        frame = requestAnimationFrame(flush);
      }
      return true;
    },
  };
}
