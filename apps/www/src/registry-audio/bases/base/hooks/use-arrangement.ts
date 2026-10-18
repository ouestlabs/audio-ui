"use client";

import type { Breakpoint } from "@audio-ui/core/envelope";
import type { Tempo } from "@audio-ui/core/time";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type Arranged,
  type ArrangementTrack,
  type AutomatedParameter,
  type Clipping,
  type Mix,
  mixOf,
  type TimeSelection,
  type TrackKind,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  type ArrangementCommand,
  type ArrangementLocator,
  type ArrangementLoop,
  type ArrangementSignature,
  apply,
  copyFrom,
  createArrangementState,
} from "@/registry-audio/bases/base/lib/arrangement-state";
import { canRedo, canUndo } from "@/registry-audio/bases/base/lib/undo-history";

/** What a clip's menu can do: renaming is the clip's own, in place, and editing opens the app's clip panel. */
export type { ClipAction } from "@/registry-audio/bases/base/lib/arrangement";
export type { ArrangementSelection } from "@/registry-audio/bases/base/lib/arrangement-state";

const NO_IDS: string[] = [];
const NO_COPIES: Arranged[] = [];

export interface UseArrangementOptions {
  /** How many colors a track can take: new tracks cycle through them. @default 5 */
  colors?: number;
  /** The length of the timeline when it starts, in seconds: a change of tempo scales it from then on, and `set-duration` sets it. */
  duration: number;
  /** The height of a folded track, in px. @default 28 */
  foldedHeight?: number;
  initialClips?: Arranged[];
  initialLocators?: ArrangementLocator[];
  initialLoop?: ArrangementLoop;
  initialSignatures?: ArrangementSignature[];
  initialTracks: ArrangementTrack[];
  /** The tempo and the time signature the timeline starts in. */
  tempo: Tempo;
}

/**
 * The state of an arrangement of clips on tracks, with the operations on it:
 * selecting, moving a group, copying, laying a clip so it covers what is
 * under it, splitting, duplicating, deleting, adding and removing tracks, each
 * track's mix and height, the tempo, the time signatures, the locators and the
 * loop, and undo and redo over all of them. The state and its commands are
 * `lib/arrangement-state`, and `lib/undo-history` holds the steps; this keeps
 * them in a component.
 */
export function useArrangement({
  colors = 5,
  duration,
  foldedHeight = 28,
  initialClips = [],
  initialLocators,
  initialLoop,
  initialSignatures,
  initialTracks,
  tempo,
}: UseArrangementOptions) {
  const [state, setState] = useState(() =>
    createArrangementState({
      colors,
      duration,
      initialClips,
      initialLocators,
      initialLoop,
      initialSignatures,
      initialTracks,
      tempo,
    })
  );
  // Read by handlers that run several times before a render: always the latest.
  const stateRef = useRef(state);
  const dispatch = useCallback((command: ArrangementCommand) => {
    const next = apply(stateRef.current, command);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
    return next;
  }, []);

  const { doc, gesture, history, selection } = state;
  const selectedIds = selection?.clips ?? NO_IDS;
  const selectedTracks = selection?.tracks ?? NO_IDS;

  // The heights set by hand (a track with none shares the room left).
  const [heights, setHeights] = useState<Record<string, number>>({});
  // Folded tracks are strips: they keep the height set by hand for when they open again.
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const toggleFold = useCallback(
    (trackId: string) =>
      setFolded((all) => ({ ...all, [trackId]: !all[trackId] })),
    []
  );
  const resizeTrack = useCallback(
    (trackId: string, height: number | undefined) => {
      // Resizing a folded track opens it.
      setFolded((all) => ({ ...all, [trackId]: false }));
      setHeights((all) => {
        // Giving the height up lets the track share the room again.
        const { [trackId]: _given, ...rest } = all;
        return height === undefined ? rest : { ...rest, [trackId]: height };
      });
    },
    []
  );
  const shownHeights = { ...heights };
  for (const id of Object.keys(folded)) {
    if (folded[id]) {
      shownHeights[id] = foldedHeight;
    }
  }

  const commands = useMemo(
    () => ({
      addTrack: (afterId?: string, kind?: TrackKind) => {
        const next = dispatch({ type: "add-track", afterId, kind });
        // The track it added is the one numbered last.
        return next.doc.tracks.find(
          (track) => track.id === `track-${next.trackCount}`
        );
      },
      changeAutomation: (
        trackId: string,
        parameter: AutomatedParameter,
        points: readonly Breakpoint[] | null
      ) => dispatch({ type: "change-automation", trackId, parameter, points }),
      changeMix: (trackId: string, patch: Partial<Mix>) => {
        const { color, ...rest } = patch;
        if (color !== undefined) {
          dispatch({ type: "set-track-color", id: trackId, color });
        }
        if (Object.keys(rest).length === 0) {
          return;
        }
        // A fader's drag is one step, closed by `settleClipEdit`; a switch is a step of its own.
        dispatch({
          type: "gain" in rest || "pan" in rest ? "change-mix" : "set-mix",
          id: trackId,
          patch: rest,
        });
      },
      clearTimeSelection: (time: TimeSelection) =>
        dispatch({ type: "clear-time", time }),
      consolidateTime: (time: TimeSelection) =>
        dispatch({ type: "consolidate-time", time }),
      copyOf: (time: TimeSelection | null): Clipping =>
        copyFrom(stateRef.current, time),
      duplicateTrack: (id: string) => dispatch({ type: "duplicate-track", id }),
      fadeTimeSelection: (time: TimeSelection) =>
        dispatch({ type: "fade-time", time }),
      insertTimeSpan: (at: number, length: number) =>
        dispatch({ type: "insert-time", at, length }),
      moveTrack: (id: string, index: number) =>
        dispatch({ type: "move-track", id, index }),
      paste: (clipping: Clipping, at: number, track: string) =>
        dispatch({ type: "paste", clipping, at, track }),
      redo: () => dispatch({ type: "redo" }),
      removeTimeSpan: (from: number, to: number) =>
        dispatch({ type: "remove-time", from, to }),
      removeTrack: (id: string) => dispatch({ type: "remove-track", id }),
      renameTrack: (id: string, name: string) =>
        dispatch({ type: "rename-track", id, name }),
      undo: () => dispatch({ type: "undo" }),
    }),
    [dispatch]
  );

  return {
    ...commands,
    /** The one way the time changes: `set-tempo`, `add-signature`, `set-loop`, `add-locator` and the rest of `ArrangementCommand`. Returns the state after the command. */
    dispatch,
    canRedo: canRedo(history),
    canUndo: canUndo(history),
    clips: doc.clips,
    copying: gesture.copying ?? NO_COPIES,
    duration: doc.duration,
    folded,
    heights: shownHeights,
    locators: doc.locators,
    loop: doc.loop,
    mixOf,
    resizeTrack,
    selectedIds,
    selectedTracks,
    selection,
    signatures: doc.signatures,
    tempo: doc.tempo,
    toggleFold,
    tracks: doc.tracks,
  };
}
