"use client";

import type { Timeline as TimelinePrimitive } from "@audio-ui/react";
import { useCallback, useRef, useState } from "react";
import type {
  Arranged,
  ArrangementTrack,
  Clipping,
  TimeSelection,
} from "@/lib/arrangement";
import type { ArrangementCommand } from "@/lib/arrangement-state";

/** The part of a key press the commands read: a native event or React's. */
type KeyPress = Pick<
  KeyboardEvent,
  | "altKey"
  | "code"
  | "ctrlKey"
  | "key"
  | "metaKey"
  | "preventDefault"
  | "shiftKey"
  | "target"
>;

/** Whether a key went to a field you type in, where copying and deleting are the field's own. */
function typing(target: EventTarget | null) {
  return (
    (target instanceof HTMLInputElement && target.type !== "range") ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export interface UseTimeSelectionOptions {
  /** How long a stretch of silence Cmd/Ctrl + I opens with no selection, in seconds: a bar. */
  bar: number;
  clips: readonly Arranged[];
  /** What a copy holds, from `useArrangement`: the stretch of time, or else the selected clips. */
  copyOf: (time: TimeSelection | null) => Clipping;
  /** The arrangement's commands, from `useArrangement`. */
  dispatch: (command: ArrangementCommand) => unknown;
  /** Where the cursor is, in seconds: where a paste lands and silence opens. */
  getPosition: () => number;
  /** Consolidates a stretch of time, as Cmd/Ctrl + J asks: what a host that renders recordings does itself, ending with the `consolidate-time` command. @default that command, with nothing rendered */
  onConsolidate?: (time: TimeSelection) => void;
  selectedIds: readonly string[];
  selectedTracks: readonly string[];
  tracks: readonly ArrangementTrack[];
}

/**
 * A stretch of time on some tracks, and what the keyboard does with it. Tell
 * it where a press on bare lane began with `pressLane`, and give
 * `onSelectionChange` to the lanes: a drag across them selects time, from the
 * track it began on to the track under the pointer. `handleKey` is what
 * Cmd/Ctrl + C and X copy and cut (the selected clips when there is no time
 * selected), V pastes at the cursor and I opens silence there; with a time
 * selection, D duplicates it after itself, J makes one clip per track of it, L
 * loops it and Delete empties it. With Shift too, X, V, D and Delete work on
 * the time itself, on every track, and Cmd/Ctrl + Alt + F makes fades from it.
 * Each is one step of undo; it says whether the key was one of these.
 */
export function useTimeSelection({
  bar,
  clips,
  copyOf,
  dispatch,
  getPosition,
  onConsolidate,
  selectedIds,
  selectedTracks,
  tracks,
}: UseTimeSelectionOptions) {
  const [time, setTime] = useState<TimeSelection | null>(null);
  const clipboard = useRef<Clipping | null>(null);
  const pressTrack = useRef<string | null>(null);

  /** A press on bare lane (with the track's id, or none under the tracks): a drag from it selects time, and the selection there was lets go. */
  const pressLane = useCallback((track: string | null) => {
    pressTrack.current = track;
    setTime(null);
  }, []);
  const clear = useCallback(() => setTime(null), []);
  const onSelectionChange = useCallback(
    (
      range: readonly [number, number],
      details: TimelinePrimitive.Lane.SelectionChangeEventDetails
    ) => {
      const order = tracks.map((track) => track.id);
      const first = order.indexOf(pressTrack.current ?? "");
      if (first === -1) {
        return;
      }
      const under = document
        .elementFromPoint(details.event.clientX, details.event.clientY)
        ?.closest<HTMLElement>("[data-track]")?.dataset.track;
      const last = under ? order.indexOf(under) : -1;
      const [top, bottom] =
        last === -1
          ? [first, first]
          : [Math.min(first, last), Math.max(first, last)];
      setTime({ range, tracks: order.slice(top, bottom + 1) });
    },
    [tracks]
  );

  /** Where a paste lands: the picked track, the top of the time selection, the track of a picked clip, or the first track. */
  const pasteTrack = () =>
    selectedTracks[0] ??
    time?.tracks[0] ??
    clips.find((clip) => selectedIds.includes(clip.id))?.track ??
    tracks[0]?.id ??
    "";
  const removeTime = (selected: TimeSelection) => {
    const [from, to] = selected.range;
    dispatch({ from, to, type: "remove-time" });
    setTime(null);
  };
  /** The time selection again right after itself, which the selection moves onto; opening, time is made for it first. */
  const duplicate = (selected: TimeSelection, opening: boolean) => {
    const clipping = copyOf(selected);
    const [from, to] = selected.range;
    const length = to - from;
    const paste: ArrangementCommand = {
      at: to,
      clipping,
      track: selected.tracks[0] ?? "",
      type: "paste",
    };
    dispatch({
      commands: opening
        ? [{ at: to, length, type: "insert-time" }, paste]
        : [paste],
      type: "batch",
    });
    setTime({ ...selected, range: [to, to + length] });
  };
  /** The last copy at the cursor; opening, time is made for it first. */
  const paste = (clipping: Clipping, opening: boolean) => {
    const at = getPosition();
    const landing: ArrangementCommand = {
      at,
      clipping,
      track: pasteTrack(),
      type: "paste",
    };
    dispatch({
      commands: opening
        ? [{ at, length: clipping.length, type: "insert-time" }, landing]
        : [landing],
      type: "batch",
    });
  };
  /** Copies, then empties the time selection (takes the time out, removing), or removes the selected clips. */
  const cut = (removing: boolean) => {
    clipboard.current = copyOf(time);
    if (time && removing) {
      removeTime(time);
    } else if (time) {
      dispatch({ time, type: "clear-time" });
    } else if (selectedIds.length > 0) {
      dispatch({
        commands: selectedIds.map((id) => ({
          id,
          type: "remove-clip" as const,
        })),
        type: "batch",
      });
    }
  };
  /** What Cmd/Ctrl + a letter does, or undefined when it does nothing here. */
  const letterCommand = (letter: string, shift: boolean) => {
    const copied = clipboard.current;
    const commands: Record<string, (() => void) | undefined> = {
      c: () => {
        clipboard.current = copyOf(time);
      },
      d: time ? () => duplicate(time, shift) : undefined,
      i: () =>
        dispatch({
          at: getPosition(),
          length: time ? time.range[1] - time.range[0] : bar,
          type: "insert-time",
        }),
      j: time
        ? () =>
            onConsolidate
              ? onConsolidate(time)
              : dispatch({ time, type: "consolidate-time" })
        : undefined,
      l: time
        ? () =>
            dispatch({
              loop: { on: true, range: [...time.range] },
              type: "set-loop",
            })
        : undefined,
      v: copied ? () => paste(copied, shift) : undefined,
      x: () => cut(shift),
    };
    return commands[letter];
  };
  /** What Delete does: empties the time selection, or with Cmd/Ctrl + Shift takes the time out of every track. */
  const deleteCommand = (event: KeyPress) => {
    if (!time) {
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      return event.shiftKey ? () => removeTime(time) : undefined;
    }
    return () => dispatch({ time, type: "clear-time" });
  };
  /** The command a key press asks for, read from the key's place with Alt, which changes the letter on a Mac. */
  const commandOf = (event: KeyPress) => {
    const mod = event.metaKey || event.ctrlKey;
    if (event.altKey) {
      return mod && event.code === "KeyF" && time
        ? () => dispatch({ time, type: "fade-time" })
        : undefined;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      return deleteCommand(event);
    }
    return mod
      ? letterCommand(event.key.toLowerCase(), event.shiftKey)
      : undefined;
  };
  const handleKey = (event: KeyPress) => {
    if (typing(event.target)) {
      return false;
    }
    const command = commandOf(event);
    if (!command) {
      return false;
    }
    event.preventDefault();
    command();
    return true;
  };

  return {
    clear,
    handleKey,
    onSelectionChange,
    pressLane,
    /** Picks the time selection itself, or lets go of it with null. */
    setTime,
    /** The stretch of time selected, on the tracks it spans. */
    time,
  };
}