import type {
  ChangeEventDetails as ExtraChangeEventDetails,
  CommitEventDetails as ExtraCommitEventDetails,
  Source,
  Store,
} from "@audio-ui/core";
import type { WaveformPeaks } from "@audio-ui/core/waveform";
import * as React from "react";

export const POSITION_PROPERTY = "--waveform-position";

export type WaveformState = {
  disabled: boolean;
  /** Whether a pointer is scrubbing the waveform. */
  dragging: boolean;
  /** Whether the audio is still on its way: there is nothing to seek yet. */
  loading: boolean;
};

/** A live playback position, in `duration` units. */
export type PositionSource = Source<number>;

/**
 * A live signal: the current levels, 0…1 each. Frequency bands, a single
 * loudness, anything worth drawing. The snapshot may be one array updated in
 * place.
 */
export type LevelsSource = Source<ArrayLike<number>>;

export type SeekChangeEventDetails =
  | ExtraChangeEventDetails<"press", PointerEvent>
  | ExtraChangeEventDetails<"drag", PointerEvent>
  | ExtraChangeEventDetails<"keyboard", KeyboardEvent>
  | ExtraChangeEventDetails<"input-change", Event>;

export type SeekCommitEventDetails =
  | ExtraCommitEventDetails<"press", PointerEvent>
  | ExtraCommitEventDetails<"drag", PointerEvent>
  | ExtraCommitEventDetails<"keyboard", KeyboardEvent>
  | ExtraCommitEventDetails<"input-change", Event>;

/** A stretch selected by dragging across the waveform with Shift held. */
export type SelectionChangeEventDetails = ExtraChangeEventDetails<
  "drag",
  PointerEvent
>;

export type SelectionCommitEventDetails = ExtraCommitEventDetails<
  "drag",
  PointerEvent
>;

/** Returns how a position on the timeline is announced. */
export type DescribeValue = (value: number, duration: number) => string;

/** A share of the track is meaningful whatever unit `duration` is in. */
export const describeAsPercent: DescribeValue = (value, duration) =>
  `${Math.round((duration > 0 ? value / duration : 0) * 100)}%`;

export interface WaveformContextValue {
  actions: {
    /** Clamp and propose a position; returns whether it was applied. */
    change: (next: number, eventDetails: SeekChangeEventDetails) => boolean;
    commit: (value: number, eventDetails: SeekCommitEventDetails) => void;
    setDragging: (dragging: boolean) => void;
  };
  meta: {
    /** How the position is announced; set by `Control`, used on every paint. */
    describeRef: React.RefObject<DescribeValue>;
    duration: number;
    /** The hovered position in `duration` units, or null. */
    hover: Store<number | null>;
    inputRef: React.RefObject<HTMLInputElement | null>;
    largeStep: number;
    /** The live signal, when there is one. */
    levels: LevelsSource | undefined;
    peaks: WaveformPeaks | undefined;
    /** The stretch of the audio shown, `[start, end]` in `duration` units. */
    range: readonly [number, number];
    /** The value at `share` of the way across the shown stretch. */
    atShare: (share: number) => number;
    /** How far across the shown stretch `value` is: 0 at its start, 1 at its end, beyond outside it. */
    toShare: (value: number) => number;
    /** The played share, 0…1, observable outside React. */
    position: Store<number>;
    step: number;
    /** Latest painted position, readable from event handlers. */
    valueRef: React.RefObject<number>;
  };
  state: WaveformState;
}

export const WaveformContext = React.createContext<WaveformContextValue | null>(
  null
);

export function useWaveformContext(part: string): WaveformContextValue {
  const context = React.use(WaveformContext);
  if (!context) {
    throw new Error(`Waveform.${part} must be used within Waveform.Root`);
  }
  return context;
}
