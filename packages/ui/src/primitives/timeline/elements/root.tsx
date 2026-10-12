import { clampFinite, createStore } from "@audio-ui/core";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import {
  type PositionChangeEventDetails,
  type PositionCommitEventDetails,
  type PositionSource,
  TimelineContext,
  type TimelineContextValue,
  type TimelineState,
  type ViewportMetrics,
  type ZoomChangeEventDetails,
} from "../context";
import { clampZoom, type ZoomAnchor } from "../internal/scale";

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

  // Position: the source's snapshot, or props/state.
  const isControlled = positionProp !== undefined;
  const [uncontrolledPosition, setUncontrolledPosition] =
    React.useState(defaultPosition);
  let knownValue = isControlled ? positionProp : uncontrolledPosition;
  if (source) {
    knownValue = source.getSnapshot();
  }
  knownValue = clampFinite(knownValue, 0, duration);
  const knownValueRef = React.useRef(knownValue);
  knownValueRef.current = knownValue;

  const [scrubbing, setScrubbingState] = React.useState(false);
  const scrubbingRef = React.useRef<boolean>(false);
  const [position] = React.useState(() => createStore(knownValue));

  const paint = React.useCallback(
    (value: number) => position.set(clampFinite(value, 0, duration)),
    [duration, position]
  );

  // While the pointer scrubs, the position follows it: neither a lagging
  // controlled value nor the live source may pull it back.
  React.useEffect(() => {
    if (!scrubbingRef.current) {
      paint(knownValue);
    }
  }, [knownValue, paint]);

  React.useEffect(() => {
    if (!source) {
      return;
    }
    const follow = () => {
      if (!scrubbingRef.current) {
        paint(source.getSnapshot());
      }
    };
    follow();
    return source.subscribe(follow);
  }, [paint, source]);

  const setScrubbing = React.useCallback(
    (next: boolean) => {
      scrubbingRef.current = next;
      setScrubbingState(next);
      if (!next) {
        paint(knownValueRef.current);
      }
    },
    [paint]
  );

  const seek = React.useCallback(
    (raw: number, eventDetails: PositionChangeEventDetails) => {
      const next = clampFinite(raw, 0, duration);
      if (next === position.get()) {
        return false;
      }
      onPositionChange?.(next, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      paint(next);
      if (!(isControlled || source)) {
        knownValueRef.current = next;
        setUncontrolledPosition(next);
      }
      return true;
    },
    [duration, isControlled, onPositionChange, paint, position, source]
  );

  const commitSeek = React.useCallback(
    (value: number, eventDetails: PositionCommitEventDetails) => {
      onPositionCommitted?.(value, eventDetails);
    },
    [onPositionCommitted]
  );

  // Zoom: px per unit, or null while fitted.
  const isZoomControlled = zoomProp !== undefined;
  const [uncontrolledZoom, setUncontrolledZoom] = React.useState<number | null>(
    defaultZoom ?? null
  );
  const zoom = isZoomControlled ? zoomProp : uncontrolledZoom;
  const anchorRef = React.useRef<ZoomAnchor | null>(null);

  const zoomTo = React.useCallback(
    (
      next: number,
      eventDetails: ZoomChangeEventDetails,
      anchor?: ZoomAnchor
    ) => {
      const clamped = clampZoom(next, minZoom, maxZoom);
      if (clamped === null || clamped === zoom) {
        return false;
      }
      onZoomChange?.(clamped, eventDetails);
      if (eventDetails.isCanceled) {
        return false;
      }
      anchorRef.current = anchor ?? null;
      if (!isZoomControlled) {
        setUncontrolledZoom(clamped);
      }
      return true;
    },
    [isZoomControlled, maxZoom, minZoom, onZoomChange, zoom]
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
    () => ({ disabled, fitted: zoom === null, scrubbing }),
    [disabled, scrubbing, zoom]
  );

  const context = React.useMemo<TimelineContextValue>(
    () => ({
      actions: {
        commitSeek,
        registerLane,
        scrollTo,
        seek,
        setScrubbing,
        zoomTo,
      },
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
        zoom,
      },
      state,
    }),
    [
      commitSeek,
      duration,
      largeStep,
      maxZoom,
      minZoom,
      position,
      registerLane,
      scrollTo,
      seek,
      setScrubbing,
      snapOffset,
      snapStep,
      state,
      step,
      viewport,
      zoom,
      zoomTo,
    ]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {},
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref,
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
    import("../context").PositionChangeEventDetails;
  export type PositionCommitEventDetails =
    import("../context").PositionCommitEventDetails;
  export type ZoomChangeEventDetails =
    import("../context").ZoomChangeEventDetails;

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
