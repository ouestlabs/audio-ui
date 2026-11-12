import type { FadeShape, Timeline as TimelinePrimitive } from "@audio-ui/react";
import { type RefObject, useCallback, useState } from "react";
import type {
  Arranged,
  ArrangementTrack,
  ClipAction,
} from "@/registry-audio/bases/base/lib/arrangement";
import type { ArrangementCommand } from "@/registry-audio/bases/base/lib/arrangement-state";

/** The track of those given whose lane is nearest `y`, up or down, in the view: where a clip let go off the tracks goes. */
function nearestTrack(
  view: HTMLElement | null,
  y: number,
  tracks: readonly ArrangementTrack[]
) {
  let nearest: string | undefined;
  let best = Number.POSITIVE_INFINITY;
  for (const lane of view?.querySelectorAll<HTMLElement>("[data-track]") ??
    []) {
    const box = lane.getBoundingClientRect();
    const distance = Math.max(box.top - y, y - box.bottom, 0);
    if (
      distance < best &&
      tracks.some((track) => track.id === lane.dataset.track)
    ) {
      best = distance;
      nearest = lane.dataset.track;
    }
  }
  return nearest;
}

export interface UseArrangedClipsOptions {
  clips: readonly Arranged[];
  /** The clips a drag with Alt held is copying, from `useArrangement`. */
  copying: readonly Arranged[];
  /** The arrangement's commands, from `useArrangement`. */
  dispatch: (command: ArrangementCommand) => unknown;
  /** Where the cursor is, in seconds: where the menu's split cuts. */
  getPosition: () => number;
  /** "Edit" was chosen from a clip's menu: the clip is selected, for the host to open its editor. */
  onEdit?: (id: string) => void;
  /** A clip was pressed, before it is selected: what else the host lets go of. */
  onPress?: () => void;
  selectedIds: readonly string[];
  /** The closest to a clip's edge the menu's split cuts, in seconds. */
  splitStep: number;
  /** The tracks a clip can be dropped on: a return track holds none. */
  tracks: readonly ArrangementTrack[];
  /** The viewport the tracks scroll in. */
  viewportRef: RefObject<HTMLElement | null>;
}

/**
 * The clips of an arrangement as commands, what every `ArrangedClip` needs:
 * spread `clipProps(clip)` on it, and draw `ghostsOn(trackId)` with
 * `ArrangedClipGhost` beside the clips of that track. A clip dropped on a track
 * moves to it if that track takes what it holds (a MIDI clip a MIDI track, an
 * audio clip an audio track); let go off the tracks, it goes to the nearest. A
 * drag with Alt held copies, and the rest of a selection follows a clip dragged
 * up or down.
 */
export function useArrangedClips({
  clips,
  copying,
  dispatch,
  getPosition,
  onEdit,
  onPress,
  selectedIds,
  splitStep,
  tracks,
  viewportRef,
}: UseArrangedClipsOptions) {
  // A clip of a selection being dragged up or down, and how far.
  const [lifting, setLifting] = useState<{ id: string; offset: number } | null>(
    null
  );
  const onLift = useCallback(
    (id: string, offset: number) =>
      setLifting(offset === 0 ? null : { id, offset }),
    []
  );
  const onSelect = useCallback(
    (id: string, additive: boolean) => {
      onPress?.();
      dispatch({ additive, id, type: "select-clip" });
    },
    [dispatch, onPress]
  );
  const onAction = useCallback(
    (action: ClipAction, id: string) => {
      if (action === "edit") {
        onSelect(id, false);
        onEdit?.(id);
        return;
      }
      dispatch({
        action,
        at: getPosition(),
        id,
        step: splitStep,
        type: "clip-action",
      });
    },
    [dispatch, getPosition, onEdit, onSelect, splitStep]
  );
  const onChange = useCallback(
    (
      id: string,
      value: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.ChangeEventDetails
    ) => dispatch({ details, id, type: "change-clip", value }),
    [dispatch]
  );
  const onCommit = useCallback(
    (id: string, details: TimelinePrimitive.Clip.CommitEventDetails) => {
      const named =
        details.lane instanceof HTMLElement
          ? details.lane.dataset.track
          : undefined;
      const dragged =
        details.reason === "drag" &&
        details.target === "move" &&
        "clientY" in details.event;
      const onto =
        named ??
        (dragged
          ? nearestTrack(viewportRef.current, details.event.clientY, tracks)
          : undefined);
      const target = tracks.find((track) => track.id === onto);
      const holdsNotes = Boolean(clips.find((clip) => clip.id === id)?.notes);
      const takes =
        target !== undefined &&
        target.kind !== "group" &&
        (target.kind === "midi") === holdsNotes;
      dispatch({
        copy: Boolean(details.copy),
        id,
        track: takes ? onto : undefined,
        type: "commit-clip",
      });
    },
    [clips, dispatch, tracks, viewportRef]
  );
  const onFadeShape = useCallback(
    (id: string, edge: "in" | "out", shape: FadeShape) =>
      dispatch({ edge, id, shape, type: "set-fade-shape" }),
    [dispatch]
  );
  const onRemove = useCallback(
    (id: string) => dispatch({ id, type: "remove-clip" }),
    [dispatch]
  );
  const onRename = useCallback(
    (id: string, name: string) => dispatch({ id, name, type: "rename-clip" }),
    [dispatch]
  );

  /** What an `ArrangedClip` takes for `clip`, but for how it is drawn: its `describe`, `peaks`, `swatch` and `trackName`. */
  const clipProps = (clip: Arranged) => ({
    clip,
    copying: copying.some((original) => original.id === clip.id),
    lift:
      lifting &&
      lifting.id !== clip.id &&
      selectedIds.includes(clip.id) &&
      selectedIds.includes(lifting.id)
        ? lifting.offset
        : 0,
    onAction,
    onChange,
    onCommit,
    onFadeShape,
    onLift,
    onRemove,
    onRename,
    onSelect,
    selected: selectedIds.includes(clip.id),
  });
  /** The originals of the clips being copied on a track: they stay where they were, drawn faint, under the copies. */
  const ghostsOn = (track: string) =>
    copying.filter((original) => original.track === track);

  return { clipProps, ghostsOn, onRemove, onRename };
}
