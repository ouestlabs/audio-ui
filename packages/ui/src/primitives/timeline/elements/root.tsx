import { clampFinite, createStore } from "@audio-ui/core";
import {
  createTimelineController,
  type TimelineOptions,
  type ZoomAnchor,
} from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  type PositionChangeEventDetails,
  type PositionSource,
  TimelineContext,
  type TimelineContextValue,
  type TimelineState,
  type ViewportMetrics,
  type ZoomChangeEventDetails,
} from "../context.ts";

/**
 * Groups the parts of a timeline and owns what they share: its length, its
 * zoom, its grid and the playback position.
 *
 * Units are yours: seconds, beats, pulses or steps. `zoom` is how many px one
 * unit takes; leave it unset and the timeline fits the width it is given. The
 * position comes from `position`, or from a live `source` that the playhead
 * follows straight in the DOM without re-rendering React. With a `snapStep`,
 * every gesture lands on the grid unless Cmd/Ctrl is held.
 * Renders a `<div>` element.
 */
export function Root(componentProps: Root.Props) {
  const {
    className,
    defaultPosition = 0,
    defaultZoom,
    disabled = false,
    duration = 1,
    largeStep: largeStepProp,
    maxZoom = Number.POSITIVE_INFINITY,
    minZoom = 0,
    onPositionChange,
    onPositionCommitted,
    onZoomChange,
    position: positionProp,
    ref,
    render,
    snapOffset = 0,
    snapStep = 0,
    source,
    step: stepProp,
    style,
    zoom: zoomProp,
    ...elementProps
  } = componentProps;
  const step = stepProp ?? (snapStep > 0 ? snapStep : duration / 100);
  const largeStep = largeStepProp ?? step * 10;

  const options: TimelineOptions = {
    defaultPosition,
    defaultZoom: defaultZoom ?? null,
    disabled,
    duration,
    grid: { offset: snapOffset, step: snapStep },
    largeStep,
    maxZoom,
    minZoom,
    onPositionChange,
    onPositionCommitted,
    onZoomChange,
    position: positionProp,
    source,
    step,
    zoom: zoomProp,
  };
  const [controller] = React.useState(() => createTimelineController(options));
  // Set on every render, so the timeline always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );

  const rootRef = React.useRef<HTMLDivElement>(null);
  const [position] = React.useState(() =>
    createStore(clampFinite(controller.getSnapshot().position, 0, duration))
  );

  // The position reaches the DOM outside React: a live source paints it every
  // frame without a render, and a drag paints it as it moves.
  const paint = React.useCallback(
    (value: number) => position.set(clampFinite(value, 0, duration)),
    [duration, position]
  );
  React.useLayoutEffect(() => {
    paint(snapshot.position);
  }, [paint, snapshot.position]);
  // A seek paints at once, so a reader right after it (a commit, the input)
  // sees the position it just reached, not the one rendered before.
  React.useLayoutEffect(
    () =>
      controller.subscribe(() => {
        paint(controller.getSnapshot().position);
      }),
    [controller, paint]
  );

  React.useEffect(() => {
    if (!source) {
      return;
    }
    const follow = () => {
      paint(controller.getSnapshot().position);
    };
    follow();
    return source.subscribe(follow);
  }, [controller, paint, source]);

  // Zoom: where the next zoom should hold still, applied once laid out.
  const anchorRef = React.useRef<ZoomAnchor | null>(null);
  const zoomTo = React.useCallback(
    (
      next: number,
      eventDetails: ZoomChangeEventDetails,
      anchor?: ZoomAnchor
    ) => {
      if (!controller.zoomTo(next, eventDetails)) {
        return false;
      }
      anchorRef.current = anchor ?? null;
      return true;
    },
    [controller]
  );

  const originLaneRef = React.useRef<HTMLElement | null>(null);
  const lanesRef = React.useRef<HTMLElement[]>([]);
  const registerLane = React.useCallback((node: HTMLElement) => {
    lanesRef.current.push(node);
    originLaneRef.current = lanesRef.current[0] ?? null;
    return () => {
      lanesRef.current = lanesRef.current.filter((lane) => lane !== node);
      originLaneRef.current = lanesRef.current[0] ?? null;
    };
  }, []);

  const viewportRef = React.useRef<HTMLElement | null>(null);
  const scrollerRef = React.useRef<((left: number) => void) | null>(null);
  const scrollTo = React.useCallback((left: number) => {
    scrollerRef.current?.(left);
  }, []);
  const [viewport] = React.useState(() =>
    createStore<ViewportMetrics>({
      origin: 0,
      scrollStart: 0,
      width: 0,
      zoom: 0,
    })
  );

  const state = React.useMemo<Root.State>(
    () => ({
      disabled: snapshot.disabled,
      fitted: snapshot.fitted,
      scrubbing: snapshot.scrubbing,
    }),
    [snapshot.disabled, snapshot.fitted, snapshot.scrubbing]
  );

  const context = React.useMemo<TimelineContextValue>(
    () => ({
      actions: {
        commitSeek: controller.commitSeek,
        registerLane,
        scrollTo,
        seek: controller.seek,
        setScrubbing: controller.setScrubbing,
        zoomTo,
      },
      controller,
      meta: {
        anchorRef,
        duration,
        grid: { offset: snapOffset, step: snapStep },
        largeStep,
        maxZoom,
        minZoom,
        originLaneRef,
        position,
        scrollerRef,
        step,
        viewport,
        viewportRef,
        zoom: snapshot.zoom,
      },
      state,
    }),
    [
      controller,
      duration,
      largeStep,
      maxZoom,
      minZoom,
      position,
      registerLane,
      scrollTo,
      snapOffset,
      snapStep,
      snapshot.zoom,
      state,
      step,
      viewport,
      zoomTo,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {},
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, rootRef] : rootRef,
    render,
    state,
  });

  return <TimelineContext value={context}>{element}</TimelineContext>;
}

export namespace Root {
  export type State = TimelineState;
  export type Source = PositionSource;
  export type ChangeEventReason = PositionChangeEventDetails["reason"];
  export type PositionChangeEventDetails =
    import("../context.ts").PositionChangeEventDetails;
  export type PositionCommitEventDetails =
    import("../context.ts").PositionCommitEventDetails;
  export type ZoomChangeEventDetails =
    import("../context.ts").ZoomChangeEventDetails;

  export interface Props extends Omit<PartProps<"div", State>, "defaultValue"> {
    /** Uncontrolled starting position. @default 0 */
    defaultPosition?: number;
    /** Uncontrolled starting zoom, in px per unit. Unset, the timeline fits its width until zoomed. */
    defaultZoom?: number;
    disabled?: boolean;
    /** Length of the timeline, in your units. @default 1 */
    duration?: number;
    /** Step for Page Up/Page Down and Shift + arrow keys. Defaults to ten `step`s. */
    largeStep?: number;
    /** @default Infinity */
    maxZoom?: number;
    /** @default 0 */
    minZoom?: number;
    /** Fires while the position is moved: press, drag, keyboard and input changes. */
    onPositionChange?: (
      value: number,
      eventDetails: PositionChangeEventDetails
    ) => void;
    /** Fires when a gesture that moved the position ends. */
    onPositionCommitted?: (
      value: number,
      eventDetails: PositionCommitEventDetails
    ) => void;
    /** Fires when the zoom changes, already clamped. `eventDetails.cancel()` keeps the zoom where it was. */
    onZoomChange?: (zoom: number, eventDetails: ZoomChangeEventDetails) => void;
    /** Playback position, from 0 to `duration`. */
    position?: number;
    /** Where the grid's lines start, in your units. @default 0 */
    snapOffset?: number;
    /** Distance between grid lines, in your units. 0 is no grid. @default 0 */
    snapStep?: number;
    /** A live position followed outside React; takes precedence over `position`. */
    source?: Source;
    /** Step for the arrow keys. Defaults to `snapStep`, or a hundredth of `duration`. */
    step?: number;
    /** Zoom, in px per unit. */
    zoom?: number;
  }
}
