import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import { useTimelineContext } from "../context";
import {
  type TrackChangeEventDetails,
  type TrackCommitEventDetails,
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
  const [resizing, setResizing] = React.useState(false);

  const resize = React.useCallback(
    (next: number, eventDetails: TrackChangeEventDetails) => {
      const clamped = Math.min(maxHeight, Math.max(minHeight, next));
      if (clamped === height) {
        return false;
      }
      onHeightChange?.(clamped, eventDetails);
      return !eventDetails.isCanceled;
    },
    [height, maxHeight, minHeight, onHeightChange]
  );
  const commit = React.useCallback(
    (next: number, eventDetails: TrackCommitEventDetails) =>
      onHeightCommitted?.(next, eventDetails),
    [onHeightCommitted]
  );

  const state = React.useMemo<TrackState>(
    () => ({ resizing, selected }),
    [resizing, selected]
  );
  const context = React.useMemo<TrackContextValue>(
    () => ({
      actions: { commit, resize, setResizing },
      meta: { height, largeStep, max: maxHeight, min: minHeight, rowRef, step },
      state,
    }),
    [commit, height, largeStep, maxHeight, minHeight, resize, state, step]
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
  export type ChangeEventDetails = TrackChangeEventDetails;
  export type CommitEventDetails = TrackCommitEventDetails;
  export interface Props extends PartProps<"div", State> {
    /** The height in px, or leave it out for the row to share what room there is. */
    height?: number | undefined;
    /** How far Page Up and Page Down move the height, in px. @default 32 */
    largeStep?: number;
    /** @default 480 */
    maxHeight?: number;
    /** @default 32 */
    minHeight?: number;
    /** A new height is asked for, by a drag or a key; `eventDetails.cancel()` refuses it. */
    onHeightChange?: (height: number, eventDetails: ChangeEventDetails) => void;
    /** A resize ended having changed the height. */
    onHeightCommitted?: (
      height: number,
      eventDetails: CommitEventDetails
    ) => void;
    /** Whether the track is the one picked: only styling, `data-selected`. @default false */
    selected?: boolean;
    /** How far an arrow key moves the height, in px. @default 8 */
    step?: number;
  }
}
