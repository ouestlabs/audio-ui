import { createChangeEventDetails, isReleased } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { VISUALLY_HIDDEN } from "../../internal/visually-hidden";
import {
  type DescribePosition,
  type TimelineContextValue,
  type TimelineState,
  useTimelineContext,
  type ViewportMetrics,
  visibleRange,
  type ZoomChangeEventDetails,
} from "../context";

/** A keypress moves the window or an edge by this share of the timeline. */
const NUDGE_SHARE = 0.02;

const describeNumber: DescribePosition = (value) =>
  String(Math.round(value * 100) / 100);

type NavigatorPart = "end" | "start" | "window";

interface NavigatorContextValue {
  /** Moves the window, or one of its edges, so it starts and ends at `next`. */
  apply: (
    part: NavigatorPart,
    next: readonly [number, number],
    eventDetails: ZoomChangeEventDetails
  ) => void;
  describe: DescribePosition;
  duration: number;
  /** The visible stretch, in units. */
  range: readonly [number, number];
  /** Units per px of the navigator's track. */
  unitsPerPixel: () => number;
}

const NavigatorContext = React.createContext<NavigatorContextValue | null>(
  null
);

function useNavigatorContext(part: string): NavigatorContextValue {
  const context = React.use(NavigatorContext);
  if (!context) {
    throw new Error(`Timeline.${part} must be used within Timeline.Navigator`);
  }
  return context;
}

/** Scrolls or zooms the viewport so it shows `next`. */
function showRange(
  timeline: TimelineContextValue,
  metrics: ViewportMetrics,
  part: NavigatorPart,
  next: readonly [number, number],
  eventDetails: ZoomChangeEventDetails
) {
  const { actions } = timeline;
  const laneWidth = Math.max(1, metrics.width - metrics.origin);
  const [start, end] = next;
  if (part === "window" || !(end > start)) {
    if (metrics.zoom > 0) {
      actions.scrollTo(start * metrics.zoom);
    }
    return;
  }
  // Resizing the window is zooming: its start is held at the lane's start.
  const zoomed = actions.zoomTo(laneWidth / (end - start), eventDetails, {
    offset: metrics.origin,
    value: start,
  });
  if (!zoomed && metrics.zoom > 0) {
    actions.scrollTo(start * metrics.zoom);
  }
}

/**
 * The whole timeline as one bar, with the stretch the viewport shows drawn
 * inside it as `Timeline.NavigatorWindow`: drag the window to scroll, drag
 * one of its `Timeline.NavigatorHandle`s to zoom, double-click to show
 * everything. Place it anywhere inside `Timeline.Root`, outside the viewport.
 * Renders a `<div>` element.
 */
export function Navigator(componentProps: Navigator.Props) {
  const {
    className,
    getAriaValueText = describeNumber,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const timeline = useTimelineContext("Navigator");
  const { meta, state } = timeline;
  const { duration, viewport } = meta;
  const metrics = React.useSyncExternalStore(
    viewport.subscribe,
    viewport.get,
    viewport.get
  );
  const range = visibleRange(metrics, duration);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const metricsRef = React.useRef(metrics);
  metricsRef.current = metrics;

  const unitsPerPixel = React.useCallback(() => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    return duration / Math.max(width, 1);
  }, [duration]);

  const apply = React.useCallback(
    (
      part: NavigatorPart,
      next: readonly [number, number],
      eventDetails: ZoomChangeEventDetails
    ) => {
      showRange(timeline, metricsRef.current, part, next, eventDetails);
    },
    [timeline]
  );

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (state.disabled) {
      return;
    }
    apply(
      "end",
      [0, duration],
      createChangeEventDetails("double-click", event.nativeEvent)
    );
  };

  const context = React.useMemo<NavigatorContextValue>(
    () => ({
      apply,
      describe: getAriaValueText,
      duration,
      range,
      unitsPerPixel,
    }),
    [apply, duration, getAriaValueText, range, unitsPerPixel]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        onDoubleClick: handleDoubleClick,
        style: { position: "relative", touchAction: "none" },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, trackRef] : trackRef,
    render,
    state,
  });

  return <NavigatorContext value={context}>{element}</NavigatorContext>;
}

export namespace Navigator {
  export type State = TimelineState;
  export interface Props extends PartProps<"div", State> {
    /** Returns how a position is announced by the window and its handles. Defaults to the number. */
    getAriaValueText?: DescribePosition;
  }
}

interface NavigatorGesture {
  pointerId: number;
  range: readonly [number, number];
  startX: number;
}

/** Drag and keyboard handling shared by the window and its handles. */
function useNavigatorPart(part: NavigatorPart, disabled: boolean) {
  const navigator = useNavigatorContext(
    part === "window" ? "NavigatorWindow" : "NavigatorHandle"
  );
  const { apply, duration, range } = navigator;
  const gestureRef = React.useRef<NavigatorGesture | null>(null);
  const minSpan = duration / 1000;

  /** Where `part` lands when moved by `delta` units from `from`. */
  const moved = React.useCallback(
    (from: readonly [number, number], delta: number): [number, number] => {
      const [start, end] = from;
      if (part === "window") {
        const span = end - start;
        const next = Math.min(Math.max(0, start + delta), duration - span);
        return [next, next + span];
      }
      if (part === "start") {
        return [Math.min(Math.max(0, start + delta), end - minSpan), end];
      }
      return [
        start,
        Math.min(Math.max(start + minSpan, end + delta), duration),
      ];
    },
    [duration, minSpan, part]
  );

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    if (disabled) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      range,
      startX: event.clientX,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }
    if (isReleased(event)) {
      onPointerEnd(event);
      return;
    }
    event.stopPropagation();
    const delta = (event.clientX - gesture.startX) * navigator.unitsPerPixel();
    apply(
      part,
      moved(gesture.range, delta),
      createChangeEventDetails("drag", event.nativeEvent)
    );
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    if (gestureRef.current?.pointerId === event.pointerId) {
      gestureRef.current = null;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    const nudge = duration * NUDGE_SHARE;
    const deltas: Record<string, number> = {
      ArrowDown: -nudge,
      ArrowLeft: -nudge,
      ArrowRight: nudge,
      ArrowUp: nudge,
      End: duration,
      Home: -duration,
      PageDown: -nudge * 5,
      PageUp: nudge * 5,
    };
    const delta = deltas[event.key];
    if (delta === undefined) {
      return;
    }
    event.preventDefault();
    apply(
      part,
      moved(range, delta),
      createChangeEventDetails("keyboard", event.nativeEvent)
    );
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.currentTarget.value);
    const from = part === "end" ? range[1] : range[0];
    apply(
      part,
      moved(range, value - from),
      createChangeEventDetails("input-change", event.nativeEvent)
    );
  };

  return {
    input: { onChange, onKeyDown },
    navigator,
    pointer: {
      onLostPointerCapture: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
    },
  };
}

/**
 * The stretch of the timeline the viewport shows. Dragging it scrolls; its
 * native `<input type="range">` scrolls from the keyboard and carries its
 * accessible name. Renders a `<div>` element.
 */
export function NavigatorWindow(componentProps: NavigatorWindow.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { state } = useTimelineContext("NavigatorWindow");
  const { input, navigator, pointer } = useNavigatorPart(
    "window",
    state.disabled
  );
  const { describe, duration, range } = navigator;
  const [start, end] = range;
  const share = (value: number) =>
    `${(duration > 0 ? value / duration : 0) * 100}%`;

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...pointer,
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={`${describe(start, duration)} to ${describe(end, duration)}`}
              disabled={state.disabled}
              max={Math.max(0, duration - (end - start))}
              min={0}
              onChange={input.onChange}
              onKeyDown={input.onKeyDown}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={start}
            />
          </>
        ),
        style: {
          left: share(start),
          position: "absolute",
          width: share(end - start),
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace NavigatorWindow {
  export type State = TimelineState;
  export type Props = PartProps<"div", State>;
}

/**
 * One edge of the window: dragging it zooms, holding the other edge in
 * place. Its native `<input type="range">` does the same from the keyboard
 * and carries its accessible name. Renders a `<div>` element.
 */
export function NavigatorHandle(componentProps: NavigatorHandle.Props) {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    edge,
    ref,
    render,
    style,
    ...elementProps
  } = componentProps;
  const { state: timelineState } = useTimelineContext("NavigatorHandle");
  const { input, navigator, pointer } = useNavigatorPart(
    edge,
    timelineState.disabled
  );
  const { describe, duration, range } = navigator;
  const current = edge === "start" ? range[0] : range[1];
  const state = React.useMemo<NavigatorHandle.State>(
    () => ({ ...timelineState, edge }),
    [edge, timelineState]
  );

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        ...pointer,
        children: (
          <>
            {children}
            <input
              aria-describedby={ariaDescribedBy}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={describe(current, duration)}
              disabled={state.disabled}
              max={edge === "start" ? range[1] : duration}
              min={edge === "start" ? 0 : range[0]}
              onChange={input.onChange}
              onKeyDown={input.onKeyDown}
              step="any"
              style={VISUALLY_HIDDEN}
              type="range"
              value={current}
            />
          </>
        ),
        style: {
          left: `${(duration > 0 ? current / duration : 0) * 100}%`,
          position: "absolute",
          touchAction: "none",
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
    render,
    state,
  });
}

export namespace NavigatorHandle {
  export type State = TimelineState & {
    /** The edge of the window this handle moves. */
    edge: "end" | "start";
  };
  export interface Props extends PartProps<"div", State> {
    /** The edge of the window this handle moves. */
    edge: "end" | "start";
  }
}
