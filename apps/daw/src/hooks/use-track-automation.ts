import type { Source } from "@audio-ui/core";
import type { Breakpoint } from "@audio-ui/core/envelope";
import type { ParameterValue } from "@audio-ui/engine/device";
import { useCallback, useState, useSyncExternalStore } from "react";
import { AUTOMATED_PARAMETERS } from "@/components/audio-ui/track-automation";
import {
  type ArrangementTrack,
  type AutomatedParameter,
  deviceParameterKey,
  devicePositions,
  type Mix,
  mixAt,
  mixOf,
  parseDeviceParameter,
  type Rack,
  rackWithMacros,
  type TrackDevice,
} from "@/lib/arrangement";
import type { ArrangementCommand } from "@/lib/arrangement-state";

/** What a control needs to follow its envelope as the arrangement plays. */
export interface AutomationFollowing {
  /** The arrangement's length, in seconds. */
  duration: number;
  /** What was moved by hand on the track: it stays as set. */
  overridden?: readonly AutomatedParameter[];
  /** Where the arrangement plays, in seconds. */
  position: Source<number>;
}

const NOT_FOLLOWING = () => () => undefined;

/**
 * Renders again when `keyAt` the arrangement's position changes, only while
 * `active`: a control following an envelope renders for what it shows, not for
 * every frame of the playhead, and one with no envelope never does.
 */
function useFollow(
  { position }: AutomationFollowing,
  active: boolean,
  keyAt: (seconds: number) => string
) {
  useSyncExternalStore(
    active ? position.subscribe : NOT_FOLLOWING,
    () => (active ? keyAt(position.getSnapshot()) : ""),
    () => ""
  );
}

/** A track's mix as it plays: its volume and pan where their envelopes stand at the position, for a fader and a knob to show them moving. */
export function useAutomatedMix(
  track: ArrangementTrack,
  following: AutomationFollowing
): Mix {
  const { duration, overridden, position } = following;
  const mix = mixOf(track);
  const levelsAt = (seconds: number) =>
    mixAt(track, mix, seconds / duration, overridden);
  const active =
    duration > 0 && Boolean(track.automation?.volume || track.automation?.pan);
  useFollow(following, active, (seconds) => {
    const { gain, pan } = levelsAt(seconds);
    return `${gain.toFixed(3)}:${pan.toFixed(3)}`;
  });
  return active ? { ...mix, ...levelsAt(position.getSnapshot()) } : mix;
}

/** Whether a track has an envelope of a parameter of the device `id`. */
const automatesDevice = (track: ArrangementTrack, id: string) =>
  Object.keys(track.automation ?? {}).some(
    (key) => parseDeviceParameter(key)?.device === id
  );

/** Where a device's automated parameters stand at the position, as a key. */
const standingKey = (positions: ReadonlyMap<string, number> | undefined) =>
  [...(positions ?? [])].map(([id, at]) => `${id}=${at.toFixed(3)}`).join(",");

/**
 * A device's state as it plays: each automated parameter where its envelope
 * stands at the position, for its panel to show its knobs moving. `denormalize`
 * is the device's own, from its position along its travel to its value.
 */
export function useAutomatedDevice(
  track: ArrangementTrack,
  device: TrackDevice,
  denormalize: ((id: string, position: number) => ParameterValue) | undefined,
  following: AutomationFollowing
): TrackDevice["state"] {
  const { duration, overridden, position } = following;
  const positionsAt = (seconds: number) =>
    devicePositions(track, seconds / duration, overridden).get(device.id);
  const active =
    duration > 0 && Boolean(denormalize) && automatesDevice(track, device.id);
  useFollow(following, active, (seconds) => standingKey(positionsAt(seconds)));
  const positions = active ? positionsAt(position.getSnapshot()) : undefined;
  if (!(positions && denormalize)) {
    return device.state;
  }
  return {
    ...device.state,
    ...Object.fromEntries(
      [...positions].map(([id, at]) => [id, denormalize(id, at)])
    ),
  };
}

/** A rack as it plays: each automated macro where its envelope stands at the position, for its knob to show it moving. */
export function useAutomatedRack(
  track: ArrangementTrack,
  device: TrackDevice,
  rack: Rack,
  following: AutomationFollowing
): Rack {
  const { duration, overridden, position } = following;
  const positionsAt = (seconds: number) =>
    devicePositions(track, seconds / duration, overridden).get(device.id);
  const active = duration > 0 && automatesDevice(track, device.id);
  useFollow(following, active, (seconds) => standingKey(positionsAt(seconds)));
  return active
    ? rackWithMacros(rack, positionsAt(position.getSnapshot()))
    : rack;
}

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
 * engine), until `reenable`, or until `edit` draws that envelope again; so
 * does a device's parameter moved by hand, told through `deviceMoved`.
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
  /** Parameters of a track's device moved by hand, by their ids (a rack's macros `macro-1` to `macro-8`): those automated stop following their envelopes. */
  const deviceMoved = useCallback(
    (trackId: string, device: string, parameters: readonly string[]) => {
      const automation = tracks.find(
        (track) => track.id === trackId
      )?.automation;
      const moved = parameters
        .map((parameter) => deviceParameterKey(device, parameter))
        .filter((key) => automation?.[key]);
      if (moved.length > 0) {
        setOverridden((all) => ({
          ...all,
          [trackId]: [...new Set([...(all[trackId] ?? []), ...moved])],
        }));
      }
    },
    [tracks]
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
    deviceMoved,
    edit,
    overridden,
    parameterOf,
    reenable,
    setAutomating,
    show,
    toggle,
  };
}
