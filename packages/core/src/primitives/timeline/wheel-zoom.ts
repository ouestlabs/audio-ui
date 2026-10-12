import { createChangeEventDetails } from "../../value/events";
import type { TimelineZoomChangeEventDetails } from "./position";
import { valueAtOffset } from "./scale";

/** How far one unit of wheel delta zooms, as an exponent. */
export const WHEEL_ZOOM_SENSITIVITY = 0.0015;

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

export interface WheelZoomController {
  /** Drops the zoom that waits for the next frame. */
  dispose: () => void;
  setOptions: (options: WheelZoomOptions) => void;
  /** Takes a wheel event over the viewport: Cmd/Ctrl zooms, a bare wheel is left to scroll. Returns whether it zoomed. */
  wheel: (event: WheelEvent, element: HTMLElement) => boolean;
}

/**
 * A wheel zoom around the pointer. A trackpad sends wheel events faster than
 * frames, and each zoom lays the whole timeline out again: the deltas are
 * added up and applied once per frame, anchored on where the pointer was.
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
    options.zoomTo(
      current * Math.exp(-batch.delta * WHEEL_ZOOM_SENSITIVITY),
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
        delta: (pending?.delta ?? 0) + event.deltaY,
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
