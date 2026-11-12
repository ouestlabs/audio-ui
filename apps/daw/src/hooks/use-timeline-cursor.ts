import { snapMove } from "@audio-ui/core/timeline";
import { adjacentPoint } from "@audio-ui/react";
import { useCallback } from "react";
import type { Arranged, ArrangementTrack } from "@/lib/arrangement";

/** The part of a key press the cursor reads: a native event or React's. */
type KeyPress = Pick<
  KeyboardEvent,
  | "altKey"
  | "ctrlKey"
  | "key"
  | "metaKey"
  | "preventDefault"
  | "shiftKey"
  | "stopPropagation"
  | "target"
>;

/** Whether a key went to a field you type in, where it is the field's own. */
function typing(target: EventTarget | null) {
  return (
    (target instanceof HTMLInputElement && target.type !== "range") ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export interface UseTimelineCursorOptions {
  clips: readonly Arranged[];
  duration: number;
  /** Where the cursor is, in seconds. */
  getPosition: () => number;
  /** The times of the locators, which Alt and the arrows jump to. */
  locators: readonly { at: number }[];
  /** M: add a locator at the cursor. */
  onAddLocator: () => void;
  /** Up or Down: a track was picked. */
  onPickTrack: (id: string) => void;
  /** Puts the cursor there. */
  onSeek: (seconds: number) => void;
  selectedIds: readonly string[];
  selectedTracks: readonly string[];
  /** How far the arrows move the cursor: the grid, in seconds. */
  step: number;
  tracks: readonly ArrangementTrack[];
}

/**
 * What the keyboard does with an arrangement's cursor. `handleKey` is M, which
 * adds a locator there, and Alt with the arrows, which jump to the next locator
 * or clip edge (of the picked tracks, or of every track with none picked).
 * `handleArrowKey` is the plain arrows, Home and End: Left and Right move the
 * cursor on the grid, Home and End go to the ends of the arrangement, Up and
 * Down pick the track above or below. Call it only when the key went to the
 * view itself, not to a control that takes its arrows. Both say whether the
 * key was one of theirs.
 */
export function useTimelineCursor({
  clips,
  duration,
  getPosition,
  locators,
  onAddLocator,
  onPickTrack,
  onSeek,
  selectedIds,
  selectedTracks,
  step,
  tracks,
}: UseTimelineCursorOptions) {
  const handleKey = useCallback(
    (event: KeyPress) => {
      if (typing(event.target)) {
        return false;
      }
      if (
        event.key.toLowerCase() === "m" &&
        !(event.metaKey || event.ctrlKey || event.altKey)
      ) {
        event.preventDefault();
        onAddLocator();
        return true;
      }
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!(event.altKey && direction)) {
        return false;
      }
      const edges = clips
        .filter(
          (clip) =>
            selectedTracks.length === 0 || selectedTracks.includes(clip.track)
        )
        .flatMap((clip) => [
          clip.value.start,
          clip.value.start + clip.value.length,
        ]);
      const target = adjacentPoint(
        [...locators.map((locator) => locator.at), ...edges],
        getPosition(),
        direction === 1 ? 1 : -1
      );
      if (target === null) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      onSeek(target);
      return true;
    },
    [clips, getPosition, locators, onAddLocator, onSeek, selectedTracks]
  );

  /** Up and Down pick the track above or below the one picked, or the first or last. */
  const pickNext = useCallback(
    (direction: 1 | -1) => {
      const current =
        selectedTracks[0] ??
        clips.find((clip) => selectedIds.includes(clip.id))?.track;
      const index = tracks.findIndex((track) => track.id === current);
      const next =
        index === -1
          ? tracks.at(direction === 1 ? 0 : -1)
          : tracks[Math.min(tracks.length - 1, Math.max(0, index + direction))];
      if (next) {
        onPickTrack(next.id);
      }
    },
    [clips, onPickTrack, selectedIds, selectedTracks, tracks]
  );

  const handleArrowKey = useCallback(
    (event: KeyPress) => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return false;
      }
      const at = getPosition();
      const targets: Record<string, number> = {
        ArrowLeft: snapMove(at - step, at, { offset: 0, step }),
        ArrowRight: snapMove(at + step, at, { offset: 0, step }),
        End: Math.max(
          0,
          ...clips.map((clip) => clip.value.start + clip.value.length)
        ),
        Home: 0,
      };
      const target = targets[event.key];
      if (target !== undefined) {
        event.preventDefault();
        onSeek(Math.min(duration, Math.max(0, target)));
        return true;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        pickNext(event.key === "ArrowDown" ? 1 : -1);
        return true;
      }
      return false;
    },
    [clips, duration, getPosition, onSeek, pickNext, step]
  );

  return { handleArrowKey, handleKey };
}
