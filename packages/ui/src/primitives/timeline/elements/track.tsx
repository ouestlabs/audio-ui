import {
  createTrackController,
  type TrackHeightChangeEventDetails,
  type TrackHeightCommitEventDetails,
  type TrackOptions,
} from "@audio-ui/core/timeline";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { mergeProps, useRender } from "../../internal/render";
import { useTimelineContext } from "../context";
import {
  TrackContext,
  type TrackContextValue,
  type TrackState,
} from "./track-context";

/**
 * One track of the arrangement: a row holding a header beside a lane. Its
 * height is yours to hold: leave it out and the row shares the room it is
 * given, set it and the row keeps it, and `Timeline.TrackResizeHandle` asks
 * for a new one through `onHeightChange`. Renders a `<div>` element.
 */
export function Track(componentProps: Track.Props) {
  const {
    className,
    height,
    largeStep = 32,
    maxHeight = 480,
    minHeight = 32,
    onHeightChange,
    onHeightCommitted,
    ref,
    render,
    selected = false,
    step = 8,
    style,
    ...elementProps
  } = componentProps;
  // Part of the timeline: it has to be inside one, as the lane it holds is.
  useTimelineContext("Track");
  const rowRef = React.useRef<HTMLElement | null>(null);
  const options: TrackOptions = {
    height,
    largeStep,
    max: maxHeight,
    measure: () => rowRef.current?.getBoundingClientRect().height ?? 0,
    min: minHeight,
    onHeightChange,
    onHeightCommitted,
    step,
  };
  const [controller] = React.useState(() => createTrackController(options));
  // Set on every render, so the track always reads the latest props.
  controller.setOptions(options);
  const snapshot = React.useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );

  const state = React.useMemo<TrackState>(
    () => ({ resizing: snapshot.resizing, selected }),
    [snapshot.resizing, selected]
  );
  const context = React.useMemo<TrackContextValue>(
    () => ({
      controller,
      meta: { height, largeStep, max: maxHeight, min: minHeight, step },
      state,
    }),
    [controller, height, largeStep, maxHeight, minHeight, state, step]
  );

  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        style: {
          display: "flex",
          minWidth: "100%",
          ...(height === undefined ? {} : { height }),
        },
      },
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, rowRef] : rowRef,
    render,
    state,
  });
  return <TrackContext value={context}>{element}</TrackContext>;
}

export namespace Track {
  export type State = TrackState;
  export type ChangeEventDetails = TrackHeightChangeEventDetails;
  export type CommitEventDetails = TrackHeightCommitEventDetails;
  export interface Props extends PartProps<"div", State> {
    /** The height in px, or leave it out for the row to share what room there is. */
    height?: number | undefined;
    /** How far Page Up and Page Down move the height, in px. @default 32 */
    largeStep?: number;
    /** @default 480 */
    maxHeight?: number;
    /** @default 32 */
    minHeight?: number;
    /**
     * A new height is asked for, by a drag or a key; a double-click on the
     * handle gives the height up, which is `undefined`.
     * `eventDetails.cancel()` refuses it.
     */
    onHeightChange?: (
      height: number | undefined,
      eventDetails: ChangeEventDetails
    ) => void;
    /** A resize ended having changed the height. */
    onHeightCommitted?: (
      height: number | undefined,
      eventDetails: CommitEventDetails
    ) => void;
    /** Whether the track is the one picked: only styling, `data-selected`. @default false */
    selected?: boolean;
    /** How far an arrow key moves the height, in px. @default 8 */
    step?: number;
  }
}
