import {
  anchoredScroll,
  createWheelZoom,
  valueAtOffset,
} from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import { type TimelineState, useTimelineContext } from "../context.ts";

/**
 * The scrolling window onto the timeline. Cmd/Ctrl + wheel (and pinch on a
 * trackpad) zooms around the pointer; a bare wheel scrolls as usual. Every
 * zoom change keeps its anchor point in place, or the middle of the view when
 * there is none. It reports its scroll offset and
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

  // The wheel zoom is the controller's; the viewport measures what it needs.
  const [wheelZoom] = React.useState(() =>
    createWheelZoom({
      disabled: state.disabled,
      drawnZoom,
      duration,
      origin,
      zoomTo: actions.zoomTo,
    })
  );
  wheelZoom.setOptions({
    disabled: state.disabled,
    drawnZoom,
    duration,
    origin,
    zoomTo: actions.zoomTo,
  });

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
    const handleWheel = (event: WheelEvent) => {
      wheelZoom.wheel(event, element);
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
      wheelZoom.dispose();
    };
  }, [wheelZoom]);

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
