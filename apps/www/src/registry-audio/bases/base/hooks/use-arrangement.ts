"use client";

import type { Tempo } from "@audio-ui/core/time";
import { useCallback, useRef, useState } from "react";
import {
  type Arranged,
  type ArrangementTrack,
  type Clipping,
  mixOf,
  type TimeSelection,
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
 * Holds the state of an arrangement of clips on tracks in a component, and the
 * view of its tracks (the heights set by hand, the folded ones). The state is
 * a plain value and every change to it is a command sent with `dispatch`:
 * `lib/arrangement-state` has `apply`, and `lib/undo-history` the steps of
 * undo and redo over the clips, the tracks, their mixes, the tempo, the time
 * signatures, the locators and the loop. The hook returns the state's parts,
 * and what is read from it, such as `selectedIds` and `mixOf`.
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

  /** What a host copies: a time selection's stretch, or else the selected clips, read from the latest state. */
  const copyOf = useCallback(
    (time: TimeSelection | null): Clipping => copyFrom(stateRef.current, time),
    []
  );

  return {
    copyOf,
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
