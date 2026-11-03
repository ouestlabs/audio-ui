/**
 * The sets the performance measures play, made here: N stereo audio tracks,
 * each through the same devices, playing clips of one generated take back to
 * back, and the return tracks they send to. Nothing comes from another
 * program's sets.
 */
import type { Arranged, ArrangementTrack } from "@/lib/arrangement";
import { createArrangementState } from "@/lib/arrangement-state";
import { deviceAt, START_TEMPO, TRACK_COLOR_COUNT } from "@/lib/daw/project";
import type { SavedProject } from "@/lib/daw/storage";

/** The one recording every clip plays, and how long it is. */
export const TAKE = "take";
export const TAKE_SECONDS = 10;

/** How much each track sends to each return. */
const SEND = 0.2;

export interface LoadSetOptions {
  /** The devices on each track's chain, by library id, first to last. */
  devices: readonly string[];
  /** Whether playback loops over the whole set, so it plays as long as it is let. */
  looping?: boolean;
  /** A return track per device, by library id, that every track sends to. */
  returns?: readonly string[];
  seconds: number;
  tracks: number;
}

/** A project of `tracks` audio tracks, `seconds` long, as the app keeps one in the browser. */
export function loadSet({
  devices,
  looping = false,
  returns = [],
  seconds,
  tracks,
}: LoadSetOptions): SavedProject {
  const returnTracks: ArrangementTrack[] = returns.map((device, index) => ({
    color: index % TRACK_COLOR_COUNT,
    devices: [deviceAt(`return-device-${index + 1}`, device)],
    id: `return-${index + 1}`,
    name: `${String.fromCharCode(65 + index)} Return`,
  }));
  const sends = Object.fromEntries(
    returnTracks.map((track) => [track.id, SEND])
  );
  const audioTracks: ArrangementTrack[] = Array.from(
    { length: tracks },
    (_, index) => ({
      color: index % TRACK_COLOR_COUNT,
      devices: devices.map((device, at) =>
        deviceAt(`device-${index + 1}-${at + 1}`, device)
      ),
      id: `track-${index + 1}`,
      kind: "audio",
      name: `${index + 1} Audio`,
      ...(returnTracks.length > 0 ? { sends } : {}),
    })
  );
  const takes = Math.ceil(seconds / TAKE_SECONDS);
  const clips: Arranged[] = audioTracks.flatMap((track) =>
    Array.from({ length: takes }, (_, index) => ({
      id: `${track.id}-clip-${index + 1}`,
      name: "Take",
      recording: TAKE,
      sourceLength: TAKE_SECONDS,
      track: track.id,
      value: {
        fadeIn: 0,
        fadeOut: 0,
        length: Math.min(TAKE_SECONDS, seconds - index * TAKE_SECONDS),
        offset: 0,
        start: index * TAKE_SECONDS,
      },
    }))
  );
  const { doc } = createArrangementState({
    colors: TRACK_COLOR_COUNT,
    duration: seconds,
    initialClips: clips,
    initialLoop: { on: looping, range: [0, seconds] },
    initialReturns: returnTracks,
    initialTracks: audioTracks,
    tempo: START_TEMPO,
  });
  return { doc, recordings: [{ id: TAKE, name: "Take" }], version: 1 };
}
