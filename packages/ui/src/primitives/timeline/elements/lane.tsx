import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part.ts";
import { mergeProps, useRender } from "../../internal/render.ts";
import {
  type TimelineState,
  UNIT_PROPERTY,
  unitLength,
  useTimelineContext,
} from "../context.ts";
import { useSeekGesture } from "./seek-gesture.ts";

export interface LaneContextValue {
  elementRef: React.RefObject<HTMLElement | null>;
}

/** The lane a part sits in: what pointer positions are measured against. */
export const LaneContext = React.createContext<LaneContextValue | null>(null);

/**
 * What every lane shares: it registers with the root, so the first one
 * mounted is where value 0 is measured from, and it sets the unit its parts
 * place themselves with.
 */
export function useLaneProps(part: string) {
  const context = useTimelineContext(part);
  const { actions, meta } = context;
  const { registerLane } = actions;
  const unregisterRef = React.useRef<(() => void) | null>(null);
  const elementRef = React.useRef<HTMLElement | null>(null);

  const laneRef = React.useCallback(
    (node: HTMLElement | null) => {
      elementRef.current = node;
      unregisterRef.current?.();
      unregisterRef.current = node ? registerLane(node) : null;
    },
    [registerLane]
  );
  const [lane] = React.useState<LaneContextValue>(() => ({ elementRef }));

  const style: React.CSSProperties = {
    [UNIT_PROPERTY as string]: unitLength(meta.zoom, meta.duration),
    // What changes inside a lane (every clip moves at each zoom step) is
    // laid out and styled without the rest of the page: it is a box of its own.
    contain: "layout style",
    // What sticks out of a lane, such as a handle's widened hit area at the
    // timeline's end, must not make the timeline scroll further than it is long.
    overflowX: "clip",
    position: "relative",
    // Zoomed, the lane is at least as long as the timeline; it may grow to
    // fill the view, and its parts stay put since they are placed in px.
    ...(meta.zoom === null ? {} : { minWidth: meta.duration * meta.zoom }),
  };

  return { context, lane, laneRef, style };
}

/**
 * A strip along the timeline that its parts are placed on: a track, the
 * ruler's strip, a row of markers. Zoomed, it is as long as the timeline;
 * fitted, it takes the width it is given and the timeline is spread across
 * it. Its `--timeline-unit` CSS variable is the width of one unit. With
 * `seekable`, a press on its bare area moves the position, as on the ruler,
 * so the cursor can be put anywhere along a track; with `onSelectionChange`
 * too, a drag from there selects a stretch of time instead of scrubbing.
 * Renders a `<div>` element.
 */
export function Lane(componentProps: Lane.Props) {
  const {
    className,
    onSelectionChange,
    onSelectionCommitted,
    ref,
    render,
    seekable = false,
    style,
    ...elementProps
  } = componentProps;
  const { context, lane, laneRef, style: laneStyle } = useLaneProps("Lane");
  const { state } = context;
  const seek = useSeekGesture(context, {
    enabled: seekable,
    selecting: onSelectionChange
      ? { onSelectionChange, onSelectionCommitted }
      : undefined,
  });
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      // What a clip dragged over it finds it by.
      {
        "data-timeline-lane": "",
        ...seek,
        style: laneStyle,
      } as React.ComponentProps<"div">,
      { ...elementProps, ...resolveStyling(className, style, state) }
    ),
    ref: ref ? [ref, laneRef] : laneRef,
    render,
    state,
  });
  return <LaneContext value={lane}>{element}</LaneContext>;
}

export namespace Lane {
  export type State = TimelineState;
  export type SelectionChangeEventDetails =
    import("../context.ts").SelectionChangeEventDetails;
  export type SelectionCommitEventDetails =
    import("../context.ts").SelectionCommitEventDetails;

  export interface Props extends PartProps<"div", State> {
    /**
     * With `seekable`, fires while a drag from the lane's bare area selects a
     * stretch of time, as `[start, end]` in timeline units on the grid unless
     * Cmd/Ctrl is held: from where the press put the position to the pointer.
     * The drag then no longer scrubs. `eventDetails.cancel()` keeps the
     * selection as it was.
     */
    onSelectionChange?: (
      range: readonly [number, number],
      eventDetails: SelectionChangeEventDetails
    ) => void;
    /** Fires when a selection that changed ends. */
    onSelectionCommitted?: (
      range: readonly [number, number],
      eventDetails: SelectionCommitEventDetails
    ) => void;
    /**
     * Whether a press on the lane's bare area moves the position, and a drag
     * scrubs it, on the grid unless Cmd/Ctrl is held. @default false
     */
    seekable?: boolean;
  }
}
