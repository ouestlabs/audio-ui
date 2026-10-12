import type { Point as GeomPoint } from "@audio-ui/core";
import type { Nullable } from "@audio-ui/core/internal";
import * as React from "react";
import type { Root } from "./elements/root";
import type { Breakpoint } from "./internal/geometry";

/** The points array and its indices stay in `state`; they don't become data attributes. */
export const STATE_ATTRIBUTES_MAPPING = {
  value: () => null,
};

export interface EnvelopeContextValue {
  actions: {
    /** Add a point (normalized 0…1); blocked at `maxPoints`. */
    addPoint: (point: GeomPoint, event: MouseEvent) => void;
    commit: (
      value: Breakpoint[],
      eventDetails: Root.CommitEventDetails
    ) => void;
    /** Move one point, clamped between its neighbors; returns whether it changed. */
    movePoint: (
      index: number,
      target: GeomPoint,
      eventDetails: Root.ChangeEventDetails
    ) => boolean;
    /** Move focus to a segment's handle, the roving tab stop among them. */
    focusSegment: (index: number) => void;
    registerPoint: (index: number, node: Nullable<HTMLElement>) => void;
    registerSegment: (index: number, node: Nullable<HTMLElement>) => void;
    setFocusedSegmentIndex: (index: number) => void;
    /** Bend the segment leaving a point; returns whether it changed. */
    setCurve: (
      index: number,
      curve: number,
      eventDetails: Root.ChangeEventDetails
    ) => boolean;
    setDraggingSegment: (index: number | null) => void;
    /** Remove a point; blocked at `minPoints`. */
    removePoint: (index: number, event: MouseEvent | KeyboardEvent) => void;
    setDraggingIndex: (index: number | null) => void;
    setFocusedIndex: (index: number) => void;
  };
  meta: {
    blockedIndex: number | null;
    draggingIndex: number | null;
    draggingSegmentIndex: number | null;
    /** The roving tab stop among the segments' handles. */
    focusedSegmentIndex: number;
    /** The roving tab stop among the points. */
    focusedIndex: number;
    /** Formats a point's `x` and `y` as one string. */
    formatPoint: (x: number, y: number) => string;
    graphRef: React.RefObject<SVGSVGElement | null>;
    isAddBlocked: boolean;
    minPoints: number;
    /** Grid the pointer snaps to, in normalized units; 0 is no grid. */
    snap: number;
    step: number;
    /** Latest displayed value, readable from event handlers. */
    valueRef: React.RefObject<Breakpoint[]>;
  };
  state: Root.State;
}

export const EnvelopeContext = React.createContext<EnvelopeContextValue | null>(
  null
);

export function useEnvelopeContext(part: string): EnvelopeContextValue {
  const context = React.use(EnvelopeContext);
  if (!context) {
    throw new Error(`Envelope.${part} must be used within Envelope.Root`);
  }
  return context;
}
