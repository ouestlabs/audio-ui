"use client";

import {
  duplicateClip,
  moveClip,
  splitClip,
  type Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import { useCallback, useRef, useState } from "react";
import {
  type Arranged,
  type ArrangementTrack,
  land,
  lay,
  type Mix,
  otherSelected,
  scaleValue,
  UNITY_MIX,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  beginChange,
  canRedo,
  canUndo,
  emptyHistory,
  type History,
  recordChange,
  redo,
  settleChange,
  undo,
} from "@/registry-audio/bases/base/lib/history";

/** What a clip's menu can do: renaming is the clip's own, in place. */
export type ClipAction = "duplicate" | "remove" | "rename" | "split" | "toggle";

/** What undo and redo move between: the tracks and the clips on them. */
interface Doc {
  clips: Arranged[];
  tracks: ArrangementTrack[];
}

/** What is selected: some clips, or one whole track by its header. */
export interface ArrangementSelection {
  clips: string[];
  track: string | null;
}

const NONE: string[] = [];

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
 * pure side is `lib/arrangement` and `lib/history`; this is what keeps them in
 * a component.
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
  const [doc, setDoc] = useState<Doc>({
    clips: initialClips,
    tracks: initialTracks,
  });
  // Read by handlers that run several times before a render: always the latest.
  const docRef = useRef(doc);
  docRef.current = doc;
  const { clips, tracks } = doc;

  const [selection, setSelection] = useState<ArrangementSelection | null>(null);
  const selectedIds = selection?.clips ?? NONE;
  const selectedTrack = selection?.track ?? null;
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;

  // The history lives in a ref, so two undos in one tick see each other; the flags are what the buttons read.
  const historyRef = useRef<History<Doc>>(emptyHistory());
  const [flags, setFlags] = useState({ redo: false, undo: false });
  const setHistory = useCallback((next: History<Doc>) => {
    historyRef.current = next;
    setFlags({ redo: canRedo(next), undo: canUndo(next) });
  }, []);
  const clearHistory = useCallback(
    () => setHistory(emptyHistory()),
    [setHistory]
  );
  /** Applies a change in one go: what it replaced is one step of the history. */
  const edit = useCallback(
    (change: (current: Doc) => Doc) => {
      setHistory(recordChange(historyRef.current, docRef.current));
      const next = change(docRef.current);
      docRef.current = next;
      setDoc(next);
    },
    [setHistory]
  );
  /** Applies a change that is part of a burst (a drag): the burst is one step, closed by `settle`. */
  const burst = useCallback(
    (change: (current: Doc) => Doc) => {
      setHistory(beginChange(historyRef.current, docRef.current));
      const next = change(docRef.current);
      docRef.current = next;
      setDoc(next);
    },
    [setHistory]
  );
  /** Changes the clips without a step of the history of its own (it follows one). */
  const setClips = useCallback((change: (all: Arranged[]) => Arranged[]) => {
    const next = { ...docRef.current, clips: change(docRef.current.clips) };
    docRef.current = next;
    setDoc(next);
  }, []);

  const undoEdit = useCallback(() => {
    const step = undo(historyRef.current, docRef.current);
    if (!step) {
      return;
    }
    setHistory(step.history);
    docRef.current = step.present;
    setDoc(step.present);
    setSelection(null);
  }, [setHistory]);
  const redoEdit = useCallback(() => {
    const step = redo(historyRef.current, docRef.current);
    if (!step) {
      return;
    }
    setHistory(step.history);
    docRef.current = step.present;
    setDoc(step.present);
    setSelection(null);
  }, [setHistory]);

  // A tempo change keeps the musical positions: everything is rescaled to the new bar,
  // and what came before it no longer fits the history.
  const rescale = useCallback(
    (ratio: number) => {
      setClips((all) =>
        all.map((clip) => ({
          ...clip,
          sourceLength: clip.sourceLength * ratio,
          value: scaleValue(clip.value, ratio),
        }))
      );
      clearHistory();
    },
    [clearHistory, setClips]
  );

  // --- Selection

  const selectClips = useCallback(
    (chosen: string[]) => setSelection({ clips: chosen, track: null }),
    []
  );
  // A press selects the clip; added to the selection, or taken from it, when `additive`.
  // A press on a clip that is already in a selection keeps the selection, so the group can be dragged.
  const selectClip = useCallback((id: string, additive: boolean) => {
    setSelection((current) => {
      const chosen = current?.clips ?? [];
      if (additive) {
        return {
          clips: chosen.includes(id)
            ? chosen.filter((other) => other !== id)
            : [...chosen, id],
          track: null,
        };
      }
      return chosen.includes(id) ? current : { clips: [id], track: null };
    });
  }, []);
  const selectTrack = useCallback(
    (id: string) => setSelection({ clips: [], track: id }),
    []
  );
  const selectAll = useCallback(
    () =>
      setSelection({
        clips: docRef.current.clips.map((clip) => clip.id),
        track: null,
      }),
    []
  );
  const clearSelection = useCallback(() => setSelection(null), []);
  /** Lets go of the clips; a track picked by its header stays picked. */
  const releaseClips = useCallback(
    () => setSelection((current) => (current?.track ? current : null)),
    []
  );

  // --- Dragging clips

  // Where the selected clips were when a group drag began, so each moves by the same distance.
  const groupOrigin = useRef<Map<string, Arranged> | null>(null);
  // Where a clip dragged with Alt held started: the copy stays there.
  const copyOrigins = useRef<Arranged[] | null>(null);
  // The clip being dragged as a copy, shown while it is: its original stays behind as a ghost.
  const [copying, setCopying] = useState<Arranged[]>([]);
  const pieces = useRef(0);

  const changeClip = useCallback(
    (
      id: string,
      value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.ChangeEventDetails
    ) => {
      const selected = selectedRef.current;
      const current = docRef.current.clips;
      if (!(details.copy && copyOrigins.current)) {
        // A copy of a clip in a selection copies the whole selection.
        const dragged = current.filter((clip) =>
          selected.length > 1 && selected.includes(id)
            ? selected.includes(clip.id)
            : clip.id === id
        );
        copyOrigins.current =
          details.copy && details.target === "move" ? dragged : null;
        setCopying(copyOrigins.current ?? []);
      }
      const grouped =
        details.target === "move" &&
        details.delta !== undefined &&
        selected.length > 1 &&
        selected.includes(id);
      if (grouped && !groupOrigin.current) {
        groupOrigin.current = new Map(
          current
            .filter((clip) => selected.includes(clip.id))
            .map((clip) => [clip.id, clip])
        );
      }
      const origins = grouped ? groupOrigin.current : null;
      // The first tick of a gesture keeps what it started from; the commit closes it.
      burst((now) => ({
        ...now,
        clips: now.clips.map((clip) => {
          if (clip.id === id) {
            return { ...clip, value };
          }
          const origin = origins?.get(clip.id);
          return origin && details.delta !== undefined
            ? {
                ...clip,
                value: moveClip(
                  origin.value,
                  origin.value.start + details.delta,
                  { duration }
                ),
              }
            : clip;
        }),
      }));
    },
    [burst, duration]
  );

  // A clip dropped on another track moves to it.
  const commitClip = useCallback(
    (id: string, details: TimelinePrimitive.Clip.CommitEventDetails) => {
      const track = details.lane?.dataset.track;
      const origins = details.copy ? (copyOrigins.current ?? []) : [];
      copyOrigins.current = null;
      setCopying([]);
      const group = groupOrigin.current;
      groupOrigin.current = null;
      setHistory(settleChange(historyRef.current));
      const copyIds = origins.map((origin) => {
        pieces.current += 1;
        return `${origin.id}-${pieces.current}`;
      });
      const order = docRef.current.tracks.map((item) => item.id);
      setClips((all) =>
        land(all, {
          copyIds,
          duration,
          group: group
            ? [...group.keys()]
            : otherSelected(selectedRef.current, id),
          id,
          order,
          origins,
          track,
        })
      );
    },
    [duration, setClips, setHistory]
  );

  // --- Editing clips

  // Delete takes away the whole selection when the clip is in it.
  const removeClip = useCallback(
    (id: string) => {
      const gone = selectedRef.current.includes(id)
        ? selectedRef.current
        : [id];
      edit((current) => ({
        ...current,
        clips: current.clips.filter((clip) => !gone.includes(clip.id)),
      }));
      setSelection(null);
    },
    [edit]
  );

  /** Cuts at the position the clips `targets` picks that it is over. */
  const splitWhere = useCallback(
    (targets: (clip: Arranged) => boolean) => {
      const at = getPosition();
      edit((current) => ({
        ...current,
        clips: current.clips.flatMap((clip) => {
          const cut = targets(clip)
            ? splitClip(clip.value, at, splitStep)
            : null;
          if (!cut) {
            return [clip];
          }
          pieces.current += 1;
          return [
            { ...clip, value: cut[0] },
            { ...clip, id: `${clip.id}-${pieces.current}`, value: cut[1] },
          ];
        }),
      }));
    },
    [edit, getPosition, splitStep]
  );
  /** Cuts at the cursor: the selected clips, or every clip of the selected track that it is over. */
  const splitAtCursor = useCallback(
    () =>
      splitWhere(
        (clip) =>
          selectedRef.current.includes(clip.id) || clip.track === selectedTrack
      ),
    [selectedTrack, splitWhere]
  );

  const renameClip = useCallback(
    (id: string, name: string) => {
      const next = name.trim();
      if (
        !next ||
        next === docRef.current.clips.find((clip) => clip.id === id)?.name
      ) {
        return;
      }
      edit((current) => ({
        ...current,
        clips: current.clips.map((clip) =>
          clip.id === id ? { ...clip, name: next } : clip
        ),
      }));
    },
    [edit]
  );

  // Copies each clip right after itself, and selects the copies.
  const duplicate = useCallback(
    (chosen: Arranged[]) => {
      const copies = chosen.map((clip) => {
        pieces.current += 1;
        return {
          ...clip,
          id: `${clip.id}-${pieces.current}`,
          value: duplicateClip(clip.value, {
            duration,
            sourceLength: clip.sourceLength,
          }),
        };
      });
      edit((current) => ({
        ...current,
        clips: copies.reduce(
          (laid, copy) => lay(laid, copy, duration),
          current.clips
        ),
      }));
      setSelection({ clips: copies.map((copy) => copy.id), track: null });
      return copies;
    },
    [duration, edit]
  );
  /** Duplicates the selected clips; returns the copies. */
  const duplicateSelection = useCallback(
    () =>
      duplicate(
        docRef.current.clips.filter((clip) =>
          selectedRef.current.includes(clip.id)
        )
      ),
    [duplicate]
  );

  // What a clip's menu does: to the whole selection when the clip is in it, else to the clip alone.
  const clipAction = useCallback(
    (action: ClipAction, id: string) => {
      const ids = selectedRef.current.includes(id) ? selectedRef.current : [id];
      if (action === "remove") {
        removeClip(id);
      } else if (action === "duplicate") {
        duplicate(docRef.current.clips.filter((clip) => ids.includes(clip.id)));
      } else if (action === "split") {
        splitWhere((clip) => ids.includes(clip.id));
      } else if (action === "toggle") {
        const off = !docRef.current.clips.find((clip) => clip.id === id)
          ?.disabled;
        edit((current) => ({
          ...current,
          clips: current.clips.map((clip) =>
            ids.includes(clip.id) ? { ...clip, disabled: off } : clip
          ),
        }));
      }
    },
    [duplicate, edit, removeClip, splitWhere]
  );

  // --- Tracks

  const trackCount = useRef(initialTracks.length);
  /** Adds a track in the next color: after the track `afterId`, or below the others; returns it. */
  const addTrack = useCallback(
    (afterId?: string) => {
      trackCount.current += 1;
      const track: ArrangementTrack = {
        color: (trackCount.current - 1) % colors,
        id: `track-${trackCount.current}`,
        name: `Track ${trackCount.current}`,
      };
      edit((current) => {
        const at = afterId
          ? current.tracks.findIndex((item) => item.id === afterId) + 1
          : current.tracks.length;
        const tracks = [...current.tracks];
        tracks.splice(at || current.tracks.length, 0, track);
        return { ...current, tracks };
      });
      return track;
    },
    [colors, edit]
  );
  /** Copies a track, with its clips, right below it. */
  const duplicateTrack = useCallback(
    (id: string) => {
      const source = docRef.current.tracks.find((item) => item.id === id);
      if (!source) {
        return;
      }
      trackCount.current += 1;
      const copy: ArrangementTrack = {
        ...source,
        id: `track-${trackCount.current}`,
        name: `${source.name} copy`,
      };
      edit((current) => {
        const tracks = [...current.tracks];
        tracks.splice(tracks.findIndex((item) => item.id === id) + 1, 0, copy);
        const copies = current.clips
          .filter((clip) => clip.track === id)
          .map((clip) => {
            pieces.current += 1;
            return {
              ...clip,
              id: `${clip.id}-${pieces.current}`,
              track: copy.id,
            };
          });
        return { clips: [...current.clips, ...copies], tracks };
      });
    },
    [edit]
  );
  const renameTrack = useCallback(
    (id: string, name: string) => {
      const next = name.trim();
      if (
        !next ||
        next === docRef.current.tracks.find((item) => item.id === id)?.name
      ) {
        return;
      }
      edit((current) => ({
        ...current,
        tracks: current.tracks.map((item) =>
          item.id === id ? { ...item, name: next } : item
        ),
      }));
    },
    [edit]
  );
  /** Removes a track with the clips on it; one track always stays. */
  const removeTrack = useCallback(
    (id: string) => {
      if (docRef.current.tracks.length <= 1) {
        return;
      }
      edit((current) => ({
        clips: current.clips.filter((clip) => clip.track !== id),
        tracks: current.tracks.filter((track) => track.id !== id),
      }));
      setSelection(null);
    },
    [edit]
  );

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
          docRef.current.tracks.find((track) => track.id === trackId)?.color ??
          0;
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

  return {
    addTrack,
    canRedo: flags.redo,
    canUndo: flags.undo,
    changeClip,
    changeMix,
    clearSelection,
    clipAction,
    clips,
    commitClip,
    copying,
    duplicateSelection,
    duplicateTrack,
    folded,
    heights: shownHeights,
    mixOf,
    redo: redoEdit,
    releaseClips,
    removeClip,
    removeTrack,
    renameClip,
    renameTrack,
    rescale,
    resizeTrack,
    selectAll,
    selectClip,
    selectClips,
    selectedIds,
    selectedTrack,
    selection,
    selectTrack,
    splitAtCursor,
    tracks,
    toggleFold,
    undo: undoEdit,
  };
}
