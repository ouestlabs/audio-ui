"use client";

import {
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** The width of the track headers before any is drawn, in px. */
const LEAD_PX = 160;

/** The width of the track headers, which the lanes start after. */
function leadWidth(viewport: HTMLElement) {
  return (
    viewport.querySelector<HTMLElement>('[data-slot="timeline-track-header"]')
      ?.offsetWidth ?? LEAD_PX
  );
}

export interface UseTimelineZoomOptions {
  /** The arrangement's length, in seconds: fitted, the view shows all of it. */
  duration: number;
  /** The closest the view zooms, in px per second. @default 240 */
  maxZoom?: number;
  /** The `TimelineViewport` the timeline scrolls in: the fit is the room beside its track headers. */
  viewportRef: RefObject<HTMLDivElement | null>;
}

/**
 * The zoom of an arrangement's timeline, in px per second. It fits the
 * viewport's width beside the track headers until it is zoomed, and never goes
 * wider than that. Give it the ref of the `TimelineViewport` and spread
 * `timeline` on `Timeline`: a Cmd/Ctrl + scroll then zooms around the pointer.
 * `zoomAround` keeps a time where it is on screen (the + and - keys),
 * `zoomTo` fits a stretch of time (Z), and `zoomBack` steps back through the
 * zooms they left (X). `rescale` keeps the zoom on the same bars when the
 * tempo changes by `ratio`.
 */
export function useTimelineZoom({
  duration,
  maxZoom = 240,
  viewportRef,
}: UseTimelineZoomOptions) {
  const [fit, setFit] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    // The header column is narrower in a narrow panel: fit what is left beside it.
    const measure = () =>
      setFit(
        Math.max(0, (element.clientWidth - leadWidth(element)) / duration)
      );
    measure();
    // Measured again on the next frame, outside the layout pass that resized it.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [duration, viewportRef]);
  const zoom = Math.max(zoomed ?? fit, fit) || 8;

  // The zooms Z and the + and - keys left behind, with where the view was scrolled: X goes back through them.
  const history = useRef<{ scroll: number; zoom: number | null }[]>([]);
  /** Zooms to `next` px per second, with `value` seconds `offset` px from the viewport's left edge. */
  const zoomOnto = useCallback(
    (next: number, value: number, offset: number) => {
      const element = viewportRef.current;
      if (!element) {
        return;
      }
      history.current.push({ scroll: element.scrollLeft, zoom: zoomed });
      const clamped = Math.min(maxZoom, Math.max(fit, next));
      setZoomed(clamped <= fit ? null : clamped);
      // After the timeline has drawn the new zoom.
      requestAnimationFrame(() => {
        element.scrollLeft = leadWidth(element) + value * clamped - offset;
      });
    },
    [fit, maxZoom, viewportRef, zoomed]
  );
  /** Zooms by `factor` around the time `at`, which stays where it is on screen; out of view, around the middle of the view. */
  const zoomAround = useCallback(
    (at: number, factor: number) => {
      const element = viewportRef.current;
      if (!element) {
        return;
      }
      const lead = leadWidth(element);
      const x = lead + at * zoom - element.scrollLeft;
      const inView = x >= lead && x <= element.clientWidth;
      const offset = inView ? x : (lead + element.clientWidth) / 2;
      const value = inView ? at : (element.scrollLeft + offset - lead) / zoom;
      zoomOnto(zoom * factor, value, offset);
    },
    [viewportRef, zoom, zoomOnto]
  );
  /** Fits the stretch from `start` to `end` seconds in the view. */
  const zoomTo = useCallback(
    (start: number, end: number) => {
      const element = viewportRef.current;
      if (!element || end <= start) {
        return;
      }
      const lead = leadWidth(element);
      zoomOnto((element.clientWidth - lead) / (end - start), start, lead);
    },
    [viewportRef, zoomOnto]
  );
  const zoomBack = useCallback(() => {
    const element = viewportRef.current;
    const previous = history.current.pop();
    if (!(element && previous)) {
      return;
    }
    setZoomed(previous.zoom);
    requestAnimationFrame(() => {
      element.scrollLeft = previous.scroll;
    });
  }, [viewportRef]);
  /** Sets the zoom as a share of the fitted view: 1 or less fits it again. */
  const setRatio = useCallback(
    (ratio: number) => setZoomed(ratio <= 1 ? null : ratio * fit),
    [fit]
  );
  const rescale = useCallback(
    (ratio: number) =>
      setZoomed((current) => (current === null ? null : current / ratio)),
    []
  );
  // What `Timeline` takes: while the view fits, no zoom of its own, and never less than the fit.
  const timeline = useMemo(
    () => ({
      maxZoom,
      minZoom: fit || undefined,
      onZoomChange: setZoomed,
      zoom: zoomed === null ? undefined : zoom,
    }),
    [fit, maxZoom, zoom, zoomed]
  );
  return {
    /** The zoom that shows the whole arrangement, in px per second. */
    fit,
    /** The zoom as a share of the fitted view: 1 shows everything. */
    ratio: fit > 0 ? zoom / fit : 1,
    /** The largest `ratio` the zoom reaches. */
    maxRatio: fit > 0 ? maxZoom / fit : 1,
    rescale,
    setRatio,
    timeline,
    /** The zoom now, in px per second. */
    zoom,
    zoomAround,
    zoomBack,
    zoomTo,
  };
}