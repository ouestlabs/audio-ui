import type { TrackController } from "@audio-ui/core/timeline";
import * as React from "react";

export type TrackState = {
  /** Whether a pointer is resizing the track. */
  resizing: boolean;
  selected: boolean;
};

export interface TrackContextValue {
  /** The framework-agnostic track behind its height: what a drag, a key or a double click asks of it. */
  controller: TrackController;
  meta: {
    /** The height as set, or undefined while the track shares what is left. */
    height: number | undefined;
    largeStep: number;
    max: number;
    min: number;
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
