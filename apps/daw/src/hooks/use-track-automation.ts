"use client";

import type { Breakpoint } from "@audio-ui/core/envelope";
import { useCallback, useState } from "react";
import { AUTOMATED_PARAMETERS } from "@/components/audio-ui/track-automation";
import type {
  ArrangementTrack,
  AutomatedParameter,
  Mix,
} from "@/lib/arrangement";
import type { ArrangementCommand } from "@/lib/arrangement-state";

export interface UseTrackAutomationOptions {
  /** The arrangement's commands, as `useArrangement` returns them. */
  dispatch: (command: ArrangementCommand) => unknown;
  /** The tracks whose automation a change by hand overrides. */
  tracks: readonly ArrangementTrack[];
}

/**
 * The automation of an arrangement's tracks, as a DAW's automation mode has
 * it. `automating` shows each track's envelope over its lane and the chooser
 * of its parameter in its header (`TrackAutomation`, `TrackAutomationChooser`).
 * A gain or a pan moved by hand through `changeMix` overrides the envelope:
 * `overridden` lists, by track, what plays its mix instead (give it to the
 * engine), until `reenable`, or until `edit` draws that envelope again.
 * `clear` takes an envelope away, as one step of undo.
 */
export function useTrackAutomation({
  dispatch,
  tracks,
}: UseTrackAutomationOptions) {
  const [automating, setAutomating] = useState(false);
  const [shown, setShown] = useState<Record<string, AutomatedParameter>>({});
  const [overridden, setOverridden] = useState<
    Record<string, AutomatedParameter[]>
  >({});
  /** The parameter a track's lane shows: its volume until another is chosen. */
  const parameterOf = useCallback(
    (trackId: string): AutomatedParameter => shown[trackId] ?? "volume",
    [shown]
  );
  const show = useCallback(
    (trackId: string, parameter: AutomatedParameter) =>
      setShown((all) => ({ ...all, [trackId]: parameter })),
    []
  );
  const toggle = useCallback(() => setAutomating((on) => !on), []);
  /** A track's mix changed by hand: a fader's drag is a burst, a switch a step of its own, and an automated gain or pan stops following its envelope. */
  const changeMix = useCallback(
    (trackId: string, patch: Partial<Mix>) => {
      const automation = tracks.find(
        (track) => track.id === trackId
      )?.automation;
      const moved = AUTOMATED_PARAMETERS.filter(
        (parameter) =>
          automation?.[parameter] &&
          (parameter === "volume" ? "gain" : "pan") in patch
      );
      if (moved.length > 0) {
        setOverridden((all) => ({
          ...all,
          [trackId]: [...new Set([...(all[trackId] ?? []), ...moved])],
        }));
      }
      const { color, ...rest } = patch;
      if (color !== undefined) {
        dispatch({ color, id: trackId, type: "set-track-color" });
      }
      if (Object.keys(rest).length > 0) {
        dispatch({
          id: trackId,
          patch: rest,
          type: "gain" in rest || "pan" in rest ? "change-mix" : "set-mix",
        });
      }
    },
    [dispatch, tracks]
  );
  /** Draws a track's envelope: drawn, it plays again. */
  const edit = useCallback(
    (
      trackId: string,
      parameter: AutomatedParameter,
      points: readonly Breakpoint[]
    ) => {
      setOverridden((all) =>
        all[trackId]?.includes(parameter)
          ? {
              ...all,
              [trackId]: all[trackId].filter((item) => item !== parameter),
            }
          : all
      );
      dispatch({ parameter, points, trackId, type: "change-automation" });
    },
    [dispatch]
  );
  const clear = useCallback(
    (trackId: string, parameter: AutomatedParameter) => {
      dispatch({ parameter, points: null, trackId, type: "change-automation" });
      dispatch({ type: "settle-clip-edit" });
    },
    [dispatch]
  );
  const reenable = useCallback(() => setOverridden({}), []);
  return {
    /** Whether a change by hand overrides any envelope: what a "Re-enable automation" button waits for. */
    anyOverridden: Object.values(overridden).some(
      (parameters) => parameters.length > 0
    ),
    automating,
    changeMix,
    clear,
    edit,
    overridden,
    parameterOf,
    reenable,
    setAutomating,
    show,
    toggle,
  };
}