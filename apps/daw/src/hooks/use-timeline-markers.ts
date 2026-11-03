"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  ArrangementCommand,
  ArrangementState,
} from "@/lib/arrangement-state";

export interface UseTimelineMarkersOptions {
  /** The arrangement's commands, from `useArrangement`. */
  dispatch: (command: ArrangementCommand) => ArrangementState;
  /** Where the cursor is, in seconds: where a new locator or time signature goes. */
  getPosition: () => number;
  /** A locator or a time signature was pressed: put the cursor there. */
  onJump: (at: number) => void;
  /** A locator was double-clicked: play from there. */
  onPlay: (at: number) => void;
  /** How far the arrows move a locator or a time signature: the grid, in seconds. */
  step: number;
}

/**
 * The commands behind `TimelineLocator` and `TimelineSignature`: spread
 * `locator` on the one and `signature` on the other, with `editing` set for
 * the change `editingSignature` names. `addLocator` puts a locator at the
 * cursor; `addSignature` puts a change there, in the signature already in
 * force, and opens it to be typed.
 */
export function useTimelineMarkers({
  dispatch,
  getPosition,
  onJump,
  onPlay,
  step,
}: UseTimelineMarkersOptions) {
  const [editingSignature, setEditingSignature] = useState<string | null>(null);
  const addLocator = useCallback(
    () => dispatch({ at: getPosition(), type: "add-locator" }),
    [dispatch, getPosition]
  );
  const addSignature = useCallback(() => {
    const at = getPosition();
    const next = dispatch({ at, type: "add-signature" });
    const added = next.doc.signatures.find((change) => change.at === at);
    if (added) {
      setEditingSignature(added.id);
    }
  }, [dispatch, getPosition]);
  const locator = useMemo(
    () => ({
      onJump,
      onMove: (id: string, to: number) =>
        dispatch({ id, to, type: "move-locator" }),
      onPlay,
      onRemove: (id: string) => dispatch({ id, type: "remove-locator" }),
      onRename: (id: string, name: string) =>
        dispatch({ id, name, type: "rename-locator" }),
      step,
    }),
    [dispatch, onJump, onPlay, step]
  );
  const signature = useMemo(
    () => ({
      onEditingChange: setEditingSignature,
      onJump,
      onMove: (id: string, to: number) =>
        dispatch({ id, to, type: "move-signature" }),
      onRemove: (id: string) => dispatch({ id, type: "remove-signature" }),
      onSet: (id: string, beatsPerBar: number, beatUnit: number) =>
        dispatch({ beatsPerBar, beatUnit, id, type: "set-signature" }),
      step,
    }),
    [dispatch, onJump, step]
  );
  return { addLocator, addSignature, editingSignature, locator, signature };
}