"use client";

import type { Breakpoint } from "@audio-ui/core/envelope";
import type { FadeShape, Timeline as TimelinePrimitive } from "@audio-ui/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  type Arranged,
  type ArrangementTrack,
  type AutomatedParameter,
  type ClipAction,
  type Clipping,
  type Mix,
  type TimeSelection,
  type TrackKind,
  UNITY_MIX,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  type ArrangementCommand,
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
  duration: number;
  /** The height of a folded track, in px. @default 28 */
  foldedHeight?: number;
  /** The playback position, in the timeline's units: where a split cuts. */
  getPosition: () => number;
  initialClips?: Arranged[];
  initialTracks: ArrangementTrack[];
  /** The shortest a split piece may be, in the timeline's units. */
  splitStep: number;
}

/**
 * The state of an arrangement of clips on tracks, with the operations on it:
 * selecting, moving a group, copying, laying a clip so it covers what is
 * under it, splitting, duplicating, deleting, adding and removing tracks, each
 * track's mix and height, and undo and redo over the tracks and the clips. The
 * state and its commands are `lib/arrangement-state`, and `lib/undo-history`
 * holds the steps; this keeps them in a component.
 */
export function useArrangement({
  colors = 5,
  duration,
  foldedHeight = 28,
  getPosition,
  initialClips = [],
  initialTracks,
  splitStep,
}: UseArrangementOptions) {
  const [state, setState] = useState(() =>
    createArrangementState({ colors, duration, initialClips, initialTracks })
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
  // The length of the timeline is the host's: the state takes it as soon as it changes.
  useLayoutEffect(() => {
    dispatch({ type: "set-duration", duration });
  }, [dispatch, duration]);

  const { doc, gesture, history, selection } = state;
  const selectedIds = selection?.clips ?? NO_IDS;
  const selectedTracks = selection?.tracks ?? NO_IDS;

  // What each track's header sets, and the heights set by hand (a track with none shares the room left).
  const [mixes, setMixes] = useState<Record<string, Mix>>({});
  const mixOf = useCallback(
    (track: ArrangementTrack): Mix =>
      mixes[track.id] ?? { ...UNITY_MIX, color: track.color },
    [mixes]
  );
  const changeMix = useCallback(
    (trackId: string, patch: Partial<Mix>) =>
      setMixes((all) => {
        const color =
          stateRef.current.doc.tracks.find((track) => track.id === trackId)
            ?.color ?? 0;
        return {
          ...all,
          [trackId]: { ...(all[trackId] ?? { ...UNITY_MIX, color }), ...patch },
        };
      }),
    []
  );
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
      addClip: (clip: Arranged) => dispatch({ type: "add-clip", clip }),
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
      changeClip: (
        id: string,
        value: TimelinePrimitive.Clip.Value,
        details: TimelinePrimitive.Clip.ChangeEventDetails
      ) => dispatch({ type: "change-clip", id, value, details }),
      clearSelection: () => dispatch({ type: "clear-selection" }),
      clearTimeSelection: (time: TimeSelection) =>
        dispatch({ type: "clear-time", time }),
      clipAction: (action: ClipAction, id: string) =>
        dispatch({
          type: "clip-action",
          action,
          id,
          at: getPosition(),
          step: splitStep,
        }),
      commitClip: (
        id: string,
        details: TimelinePrimitive.Clip.CommitEventDetails
      ) => {
        // A clip dropped on another track moves to it: its lane names the track.
        const track =
          details.lane instanceof HTMLElement
            ? details.lane.dataset.track
            : undefined;
        dispatch({
          type: "commit-clip",
          id,
          copy: Boolean(details.copy),
          track,
        });
      },
      consolidateTime: (time: TimeSelection) =>
        dispatch({ type: "consolidate-time", time }),
      copyOf: (time: TimeSelection | null): Clipping =>
        copyFrom(stateRef.current, time),
      crop: (id: string) => dispatch({ type: "crop-clip", id }),
      duplicateSelection: () => {
        const next = dispatch({ type: "duplicate-selection" });
        // The copies are the selection the command leaves, in the order it lists them.
        return (next.selection?.clips ?? NO_IDS).flatMap((id) =>
          next.doc.clips.filter((clip) => clip.id === id)
        );
      },
      duplicateTrack: (id: string) => dispatch({ type: "duplicate-track", id }),
      editClip: (id: string, change: (clip: Arranged) => Arranged) =>
        dispatch({ type: "edit-clip", id, change }),
      fadeTimeSelection: (time: TimeSelection) =>
        dispatch({ type: "fade-time", time }),
      insertTimeSpan: (at: number, length: number) =>
        dispatch({ type: "insert-time", at, length }),
      moveTrack: (id: string, index: number) =>
        dispatch({ type: "move-track", id, index }),
      paste: (clipping: Clipping, at: number, track: string) =>
        dispatch({ type: "paste", clipping, at, track }),
      redo: () => dispatch({ type: "redo" }),
      releaseClips: () => dispatch({ type: "release-clips" }),
      removeClip: (id: string) => dispatch({ type: "remove-clip", id }),
      removeTimeSpan: (from: number, to: number) =>
        dispatch({ type: "remove-time", from, to }),
      removeTrack: (id: string) => dispatch({ type: "remove-track", id }),
      renameClip: (id: string, name: string) =>
        dispatch({ type: "rename-clip", id, name }),
      renameTrack: (id: string, name: string) =>
        dispatch({ type: "rename-track", id, name }),
      rescale: (ratio: number) => dispatch({ type: "rescale", ratio }),
      selectAll: () => dispatch({ type: "select-all" }),
      selectClip: (id: string, additive: boolean) =>
        dispatch({ type: "select-clip", id, additive }),
      selectClips: (ids: string[]) => dispatch({ type: "select-clips", ids }),
      selectTrack: (id: string, additive = false) =>
        dispatch({ type: "select-track", id, additive }),
      setFadeShape: (id: string, edge: "in" | "out", shape: FadeShape) =>
        dispatch({ type: "set-fade-shape", id, edge, shape }),
      settleClipEdit: () => dispatch({ type: "settle-clip-edit" }),
      splitAtCursor: () =>
        dispatch({ type: "split-cursor", at: getPosition(), step: splitStep }),
      toggleSelected: () => dispatch({ type: "toggle-selected" }),
      undo: () => dispatch({ type: "undo" }),
    }),
    [dispatch, getPosition, splitStep]
  );

  return {
    ...commands,
    canRedo: canRedo(history),
    canUndo: canUndo(history),
    changeMix,
    clips: doc.clips,
    copying: gesture.copying ?? NO_COPIES,
    folded,
    heights: shownHeights,
    mixOf,
    resizeTrack,
    selectedIds,
    selectedTracks,
    selection,
    toggleFold,
    tracks: doc.tracks,
  };
}
