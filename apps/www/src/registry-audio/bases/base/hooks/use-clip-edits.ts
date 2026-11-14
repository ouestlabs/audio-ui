import type { createSource } from "@audio-ui/react";
import { type KeyboardEvent, useCallback, useMemo, useState } from "react";
import {
  FLAT,
  LEVEL_NUDGE,
  MAX_DB,
  MIN_DB,
  type SelectionShape,
} from "@/registry-audio/bases/base/audio/elements/selection-frame";
import type { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import type {
  Clipping,
  TimeSelection,
} from "@/registry-audio/bases/base/lib/arrangement";
import type { ArrangementCommand } from "@/registry-audio/bases/base/lib/arrangement-state";
import {
  EDGE_EPS,
  removing,
  SHRINK_GAP,
  shapeOf,
  shapeStretch,
  splice,
  typing,
} from "@/registry-audio/bases/base/lib/clip-edits";

/**
 * The edits of the sound, as an audio editor makes them, each one step of
 * undo: on the time selected, Cut and Copy; Paste makes room for what it lays
 * down, over the selection if there is one; Delete and Crop close the gap they
 * leave; Mark puts a locator at the selection's start, or at the cursor;
 * Louder and Quieter move the selection's level by 3 dB. The arrangement's
 * length and loop follow the sound's. Each is sent by `act` with the name the
 * history lists. `handleKey` is the keyboard of all of them, with Undo and
 * Redo.
 */
export function useClipEdits({
  act,
  arrangement,
  notify,
  pauses,
  position,
  track,
}: {
  /** Sends a command as a step of the history, by the name the history lists. */
  act: (label: string, command: ArrangementCommand) => void;
  arrangement: ReturnType<typeof useArrangement>;
  /** Says something in the editor's status line, for what an edit had nothing to do on. */
  notify: (text: string) => void;
  /** The silences of the sound as it lies, in order, as [from, to]: what trimming and shrinking take out. */
  pauses: readonly (readonly [number, number])[];
  position: ReturnType<typeof createSource<number>>;
  /** The track the sound is on. */
  track: string;
}) {
  const { copyOf, dispatch, doc } = arrangement;
  const [time, setTime] = useState<TimeSelection | null>(null);
  const [clipboard, setClipboard] = useState<Clipping | null>(null);
  const length = doc.duration;

  /** One step of undo: the edit, then the arrangement's length and loop set to the sound's new length. */
  const commit = useCallback(
    (label: string, commands: ArrangementCommand[], next: number) =>
      act(label, {
        commands: [
          ...commands,
          { duration: next, type: "set-duration" },
          { loop: { range: [0, next] }, type: "set-loop" },
        ],
        type: "batch",
      }),
    [act]
  );
  const removeAs = useCallback(
    (label: string) => {
      if (!time) {
        return;
      }
      const [from, to] = time.range;
      const next = length - (to - from);
      commit(
        label,
        [...removing(from, to), ...splice(track, from, next)],
        next
      );
      setTime(null);
      position.set(from);
    },
    [commit, length, position, time, track]
  );
  const remove = useCallback(() => removeAs("Delete"), [removeAs]);
  const copy = useCallback(() => {
    if (time) {
      setClipboard(copyOf(time));
    }
  }, [copyOf, time]);
  const cut = useCallback(() => {
    if (time) {
      setClipboard(copyOf(time));
      removeAs("Cut");
    }
  }, [copyOf, removeAs, time]);
  const paste = useCallback(() => {
    if (!clipboard) {
      return;
    }
    const at = time ? time.range[0] : Math.min(position.getSnapshot(), length);
    const over = time ? time.range[1] - time.range[0] : 0;
    const next = length - over + clipboard.length;
    commit(
      "Paste",
      [
        ...(time ? removing(time.range[0], time.range[1]) : []),
        { at, length: clipboard.length, type: "insert-time" },
        { at, clipping: clipboard, track, type: "paste" },
        ...splice(track, at, next),
        ...splice(track, at + clipboard.length, next),
      ],
      next
    );
    setTime({ range: [at, at + clipboard.length], tracks: [track] });
  }, [clipboard, commit, length, position, time, track]);
  const crop = useCallback(() => {
    if (!time) {
      return;
    }
    const [from, to] = time.range;
    commit("Crop", [...removing(to, length), ...removing(0, from)], to - from);
    setTime({ range: [0, to - from], tracks: [track] });
    position.set(0);
  }, [commit, length, position, time, track]);
  // The silence at the start and at the end taken off, as a clip of audio.js's `trim`.
  const trimSilence = useCallback(() => {
    const lead = pauses.find(([from]) => from <= EDGE_EPS);
    const tail = pauses.find(([, to]) => to >= length - EDGE_EPS);
    const cutTail = tail && tail !== lead ? tail[1] - tail[0] : 0;
    const cutLead = lead ? lead[1] - lead[0] : 0;
    if (cutLead + cutTail <= 0) {
      notify("No silence at the start or the end");
      return;
    }
    const next = length - cutLead - cutTail;
    commit(
      "Trim silence",
      [
        ...(tail && tail !== lead ? removing(tail[0], tail[1]) : []),
        ...(lead ? removing(lead[0], lead[1]) : []),
      ],
      next
    );
    setTime(null);
    position.set(0);
  }, [commit, length, notify, pauses, position]);
  // Every pause between sounds cut down to `gap` seconds, as audio.js's `shrink`: the middle of each taken out, last first so the places hold.
  const shrinkPauses = useCallback(
    (gap = SHRINK_GAP) => {
      const inside = pauses.filter(
        ([from, to]) =>
          from > EDGE_EPS && to < length - EDGE_EPS && to - from > gap
      );
      if (inside.length === 0) {
        notify(`No pause longer than ${gap} s`);
        return;
      }
      const taken = inside.reduce(
        (sum, [from, to]) => sum + (to - from - gap),
        0
      );
      const commands: ArrangementCommand[] = [];
      for (const [from, to] of [...inside].reverse()) {
        commands.push(...removing(from + gap / 2, to - gap / 2));
      }
      // The seams, from the start: each one sits where it ended up after the cuts before it.
      let before = 0;
      for (const [from, to] of inside) {
        commands.push(
          ...splice(track, from + gap / 2 - before, length - taken)
        );
        before += to - from - gap;
      }
      commit(
        gap === 0 ? "Remove pauses" : `Shrink pauses to ${gap} s`,
        commands,
        length - taken
      );
      setTime(null);
    },
    [commit, length, notify, pauses, track]
  );
  const mark = useCallback(
    () =>
      act("Mark", {
        at: time ? time.range[0] : position.getSnapshot(),
        type: "add-locator",
      }),
    [act, position, time]
  );
  const selectAll = useCallback(
    () => setTime({ range: [0, length], tracks: [track] }),
    [length, track]
  );
  const clear = useCallback(() => setTime(null), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);
  const clips = useMemo(
    () => doc.clips.filter((clip) => clip.track === track),
    [doc.clips, track]
  );
  /** Fades and level on the selection, as one step named `label`: what is in it becomes clips of its own, shaped. */
  const shape = useCallback(
    (next: SelectionShape, label: string) => {
      if (time) {
        act(label, {
          commands: shapeStretch(clips, time.range, next),
          type: "batch",
        });
      }
    },
    [act, clips, time]
  );
  /** The selection's level moved by `db`, up to the top of the range: past 0 dB, it is a boost. */
  const nudge = useCallback(
    (db: number) => {
      if (time) {
        const now = shapeOf(clips, time.range);
        shape(
          { ...now, gain: Math.min(MAX_DB, Math.max(MIN_DB, now.gain + db)) },
          db > 0 ? "Louder" : "Quieter"
        );
      }
    },
    [clips, shape, time]
  );
  const louder = useCallback(() => nudge(LEVEL_NUDGE), [nudge]);
  const quieter = useCallback(() => nudge(-LEVEL_NUDGE), [nudge]);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (typing(event.target)) {
        return;
      }
      const withMod: Record<string, (() => void) | undefined> = {
        a: selectAll,
        c: copy,
        v: paste,
        x: cut,
        y: redo,
        z: event.shiftKey ? redo : undo,
      };
      const alone: Record<string, (() => void) | undefined> = {
        backspace: remove,
        delete: remove,
        escape: clear,
        k: crop,
        m: mark,
        // Shift with Up and Down: louder and quieter.
        ...(event.shiftKey ? { arrowdown: quieter, arrowup: louder } : {}),
      };
      const command = (event.metaKey || event.ctrlKey ? withMod : alone)[
        event.key.toLowerCase()
      ];
      if (command) {
        event.preventDefault();
        command();
      }
    },
    [
      clear,
      copy,
      crop,
      cut,
      louder,
      mark,
      paste,
      quieter,
      redo,
      remove,
      selectAll,
      undo,
    ]
  );

  return {
    clear,
    clipboard,
    copy,
    crop,
    cut,
    handleKey,
    shrinkPauses,
    trimSilence,
    louder,
    mark,
    paste,
    quieter,
    redo,
    remove,
    selectAll,
    setTime,
    shape,
    /** What the selection has now: its fades and level, read from the clip it covers exactly. */
    shapeNow: time ? shapeOf(clips, time.range) : FLAT,
    time,
    undo,
  };
}
