import * as React from "react";
import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
} from "../../internal/event-details";

export type TrackChangeEventDetails =
  | ExtraChangeEventDetails<"drag", PointerEvent>
  | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
  | ExtraChangeEventDetails<"input-change", Event>
  | ExtraChangeEventDetails<"double-click", MouseEvent>;

export type TrackCommitEventDetails =
  | ExtraCommitEventDetails<"drag", PointerEvent>
  | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
  | ExtraCommitEventDetails<"input-change", Event>
  | ExtraCommitEventDetails<"double-click", MouseEvent>;

export type TrackState = {
  /** Whether a pointer is resizing the track. */
  resizing: boolean;
  selected: boolean;
};

export interface TrackContextValue {
  actions: {
    /** Propose a height; returns whether it was applied. */
    resize: (height: number, eventDetails: TrackChangeEventDetails) => boolean;
    commit: (
      height: number | undefined,
      eventDetails: TrackCommitEventDetails
    ) => void;
    /** Gives the height up, so the row shares the room again. */
    reset: (event: MouseEvent) => void;
    setResizing: (resizing: boolean) => void;
  };
  meta: {
    /** The height as set, or undefined while the track shares what is left. */
    height: number | undefined;
    largeStep: number;
    max: number;
    min: number;
    /** The track as drawn, to measure while its height is not set. */
    rowRef: React.RefObject<HTMLElement | null>;
    step: number;
  };
  state: TrackState;
}

export const TrackContext = React.createContext<TrackContextValue | null>(null);

export function useTrackContext(part: string): TrackContextValue {
  const context = React.use(TrackContext);
  if (!context) {
    throw new Error(`Timeline.${part} must be used within Timeline.Track`);
  }
  return context;
}
