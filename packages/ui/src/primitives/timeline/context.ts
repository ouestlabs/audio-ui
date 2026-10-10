import * as React from "react";
import type { Source } from "../../source";
import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "../internal/event-details";
import type { Store } from "../internal/store";
import type { ZoomAnchor } from "./internal/scale";
import type { Grid } from "./internal/snap";

/** Set on every lane: the width of one unit of time, so parts place themselves with `calc()`. */
export const UNIT_PROPERTY = "--timeline-unit";

export type TimelineState = {
  disabled: boolean;
  /** Whether no zoom is set, so the timeline fits the width it is given. */
  fitted: boolean;
  /** Whether a pointer is moving the position. */
  scrubbing: boolean;
};

/** A live position, in the timeline's units. */
export type PositionSource = Source<number>;

/** Scroll offset and visible width of the viewport, in px. */
export interface ViewportMetrics {
  scrollStart: number;
  width: number;
}

export type PositionChangeEventDetails =
  | ExtraChangeEventDetails<"press", PointerEvent>
  | ExtraChangeEventDetails<"drag", PointerEvent>
  | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
  | ExtraChangeEventDetails<"input-change", Event>;

export type PositionCommitEventDetails =
  | ExtraCommitEventDetails<"press", PointerEvent>
  | ExtraCommitEventDetails<"drag", PointerEvent>
  | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
  | ExtraCommitEventDetails<"input-change", Event>;

export type ZoomChangeEventDetails = ExtraChangeEventDetails<
  "wheel",
  WheelEvent
>;

/** Returns how a position is announced. */
export type DescribePosition = (value: number, duration: number) => string;

export interface TimelineContextValue {
  actions: {
    commitSeek: (
      value: number,
      eventDetails: PositionCommitEventDetails
    ) => void;
    /** Registers a lane; the first one mounted is where value 0 is measured from. */
    registerLane: (node: HTMLElement) => () => void;
    /** Clamp and propose a position; returns whether it was applied. */
    seek: (next: number, eventDetails: PositionChangeEventDetails) => boolean;
    setScrubbing: (scrubbing: boolean) => void;
    /** Clamp and propose a zoom, held still around `anchor`; returns whether it was applied. */
    zoomTo: (
      next: number,
      eventDetails: ZoomChangeEventDetails,
      anchor?: ZoomAnchor
    ) => boolean;
  };
  meta: {
    /** Where the next zoom should hold still; the viewport applies it once laid out. */
    anchorRef: React.RefObject<ZoomAnchor | null>;
    duration: number;
    grid: Grid;
    largeStep: number;
    maxZoom: number;
    minZoom: number;
    /** The first lane mounted. */
    originLaneRef: React.RefObject<HTMLElement | null>;
    /** The position, observable outside React. */
    position: Store<number>;
    step: number;
    viewport: Store<ViewportMetrics>;
    viewportRef: React.RefObject<HTMLElement | null>;
    /** px per unit, or null while the timeline fits its width. */
    zoom: number | null;
  };
  state: TimelineState;
}

export const TimelineContext = React.createContext<TimelineContextValue | null>(
  null
);

export function useTimelineContext(part: string): TimelineContextValue {
  const context = React.use(TimelineContext);
  if (!context) {
    throw new Error(`Timeline.${part} must be used within Timeline.Root`);
  }
  return context;
}

/** The width of one unit: px when zoomed, a share of the lane when fitted. */
export function unitLength(zoom: number | null, duration: number): string {
  return zoom === null
    ? `calc(100% / ${duration > 0 ? duration : 1})`
    : `${zoom}px`;
}

/** Set on every placed part: where it sits, in units. */
export const OFFSET_PROPERTY = "--timeline-offset";

/** Places a part at its `--timeline-offset` along the lane. */
export function placedAt(value: number): React.CSSProperties {
  return {
    [OFFSET_PROPERTY as string]: value,
    left: `calc(var(${UNIT_PROPERTY}) * var(${OFFSET_PROPERTY}))`,
    position: "absolute",
  };
}

/** The value under `clientX` on `lane`, within the timeline. */
export function valueAtPointer(
  lane: HTMLElement,
  clientX: number,
  zoom: number | null,
  duration: number
): number {
  const rect = lane.getBoundingClientRect();
  const unit = zoom ?? rect.width / Math.max(duration, Number.MIN_VALUE);
  const value = (clientX - rect.left) / Math.max(unit, Number.MIN_VALUE);
  return Math.min(duration, Math.max(0, value));
}
