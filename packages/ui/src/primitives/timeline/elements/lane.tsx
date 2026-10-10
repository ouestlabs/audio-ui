import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { type PartProps, resolveStyling } from "../../internal/part";
import {
  type TimelineState,
  UNIT_PROPERTY,
  unitLength,
  useTimelineContext,
} from "../context";

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
 * it. Its `--timeline-unit` CSS variable is the width of one unit.
 * Renders a `<div>` element.
 */
export function Lane(componentProps: Lane.Props) {
  const { className, ref, render, style, ...elementProps } = componentProps;
  const { context, lane, laneRef, style: laneStyle } = useLaneProps("Lane");
  const { state } = context;
  const element = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      { style: laneStyle },
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
  export type Props = PartProps<"div", State>;
}
