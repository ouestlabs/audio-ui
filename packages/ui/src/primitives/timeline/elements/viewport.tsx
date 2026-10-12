import { createChangeEventDetails } from "@audio-ui/core";
import { anchoredScroll, valueAtOffset } from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { type TimelineState, useTimelineContext } from "../context";

/** How far one unit of wheel delta zooms, as an exponent. */
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

/**
 * The scrolling window onto the timeline. Cmd/Ctrl + wheel (and pinch on a
 * trackpad) zooms around the pointer; a bare wheel scrolls as usual. Whatever
 * changes the zoom, the point it was anchored on stays where it was, or the
 * middle of the view when nothing named one. It reports its scroll offset and
 * width for `Timeline.Navigator`. Renders a `<div>` element.
 */
export function Viewport(componentProps: Viewport.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { actions, meta, state } = useTimelineContext("Viewport");
  const {
    anchorRef,
    duration,
    originLaneRef,
    scrollerRef,
    viewport,
    viewportRef,
    zoom,
  } = meta;
  const elementRef = React.useRef<HTMLDivElement>(null);
  // The zoom and scroll the last layout was at: holding a point still
  // through a zoom needs where it was before.
  const previousRef = React.useRef<{
    scrollStart: number;
    zoom: number;
  } | null>(null);

  /** Where value 0 sits in the scrolled content, in px. */
  const origin = React.useCallback(() => {
    const element = elementRef.current;
    const lane = originLaneRef.current;
    if (!(element && lane)) {
      return 0;
    }
    return (
      lane.getBoundingClientRect().left -
      element.getBoundingClientRect().left +
      element.scrollLeft
    );
  }, [originLaneRef]);

  /** px per unit as drawn: the zoom, or what fitting the width gives. */
  const drawnZoom = React.useCallback(() => {
    if (zoom !== null) {
      return zoom;
    }
    const width = originLaneRef.current?.getBoundingClientRect().width ?? 0;
    return width / Math.max(duration, Number.MIN_VALUE);
  }, [duration, originLaneRef, zoom]);

  const report = React.useCallback(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const next = {
      origin: origin(),
      scrollStart: element.scrollLeft,
      width: element.clientWidth,
      zoom: drawnZoom(),
    };
    const current = viewport.get();
    if (
      current.origin !== next.origin ||
      current.scrollStart !== next.scrollStart ||
      current.width !== next.width ||
      current.zoom !== next.zoom
    ) {
      viewport.set(next);
    }
  }, [drawnZoom, origin, viewport]);

  React.useEffect(() => {
    const element = elementRef.current;
    viewportRef.current = element;
    if (!element) {
      return;
    }
    scrollerRef.current = (left: number) => {
      element.scrollLeft = left;
      if (previousRef.current) {
        previousRef.current.scrollStart = element.scrollLeft;
      }
      report();
    };
    report();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(report);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      viewportRef.current = null;
      scrollerRef.current = null;
    };
  }, [report, scrollerRef, viewportRef]);

  // The one place that reacts to the zoom changing, whatever changed it.
  React.useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const current = drawnZoom();
    const previous = previousRef.current;
    if (previous && previous.zoom > 0 && previous.zoom !== current) {
      const middle = element.clientWidth / 2;
      const anchor = anchorRef.current ?? {
        offset: middle,
        value: valueAtOffset(
          middle,
          previous.scrollStart,
          previous.zoom,
          origin()
        ),
      };
      anchorRef.current = null;
      element.scrollLeft = anchoredScroll(anchor, current, origin());
    }
    previousRef.current = { scrollStart: element.scrollLeft, zoom: current };
    report();
  }, [anchorRef, drawnZoom, origin, report]);

  // Attached natively: React listens to wheel passively, so a handler there
  // could not stop the page from scrolling while it zooms.
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    // A trackpad sends wheel events faster than frames, and each zoom lays the
    // whole timeline out again: they are added up and applied once per frame.
    let pending: { delta: number; event: WheelEvent } | null = null;
    let frame = 0;
    const flush = () => {
      frame = 0;
      const batch = pending;
      pending = null;
      if (!batch) {
        return;
      }
      const current = drawnZoom();
      if (!(current > 0)) {
        return;
      }
      const offset = batch.event.clientX - element.getBoundingClientRect().left;
      const value = valueAtOffset(
        offset,
        element.scrollLeft,
        current,
        origin()
      );
      actions.zoomTo(
        current * Math.exp(-batch.delta * WHEEL_ZOOM_SENSITIVITY),
        createChangeEventDetails("wheel", batch.event),
        { offset, value: Math.min(duration, Math.max(0, value)) }
      );
    };
    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || state.disabled) {
        return;
      }
      event.preventDefault();
      pending = { delta: (pending?.delta ?? 0) + event.deltaY, event };
      if (!frame) {
        frame = requestAnimationFrame(flush);
      }
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(frame);
    };
  }, [actions, drawnZoom, duration, origin, state.disabled]);

  const handleScroll = () => {
    const element = elementRef.current;
    if (element && previousRef.current) {
      previousRef.current.scrollStart = element.scrollLeft;
    }
    report();
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { onScroll: handleScroll, style: { overflowX: "auto" } },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, elementRef] : elementRef,
    render,
    state,
  });
}

export namespace Viewport {
  export type State = TimelineState;
  export type Props = PartProps<"div", State>;
}
