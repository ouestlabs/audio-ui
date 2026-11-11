/**
 * The sets the performance measures play, made here: N stereo audio tracks,
 * each through the same devices, playing clips of one generated take back to
 * back, and the return tracks they send to. Nothing comes from another
 * program's sets.
 */
import type { WarpMode } from "@audio-ui/engine/playback";
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
  /** Plays each clip 1.12 times slower than it was recorded, in this mode. */
  warpMode?: WarpMode;
}

/** A project of `tracks` audio tracks, `seconds` long, as the app keeps one in the browser. */
export function loadSet({
  devices,
  looping = false,
  returns = [],
  seconds,
  tracks,
  warpMode,
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
      ...(warpMode
        ? {
            warp: [
              { source: 0, target: 0 },
              { source: TAKE_SECONDS / 1.12, target: TAKE_SECONDS },
            ],
            warpMode,
          }
        : {}),
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

/**
 * A project of `tracks` stems of `seconds` each, every one its own recording
 * from the start, with no device: a set as long as the user's longest. Its
 * recordings are streamed from the cache, which the measure writes itself.
 */
export function stemSet({
  seconds,
  tracks,
}: {
  seconds: number;
  tracks: number;
}): SavedProject {
  const stems: ArrangementTrack[] = Array.from(
    { length: tracks },
    (_, index) => ({
      color: index % TRACK_COLOR_COUNT,
      id: `track-${index + 1}`,
      kind: "audio",
      name: `${index + 1} Stem`,
    })
  );
  const clips: Arranged[] = stems.map((track, index) => ({
    id: `${track.id}-stem`,
    name: "Stem",
    recording: `rec-${index + 1}`,
    sourceLength: seconds,
    track: track.id,
    value: { fadeIn: 0, fadeOut: 0, length: seconds, offset: 0, start: 0 },
  }));
  const { doc } = createArrangementState({
    colors: TRACK_COLOR_COUNT,
    duration: seconds,
    initialClips: clips,
    initialTracks: stems,
    tempo: START_TEMPO,
  });
  return {
    doc,
    recordings: stems.map((_, index) => ({
      id: `rec-${index + 1}`,
      name: `Stem ${index + 1}`,
    })),
    version: 1,
  };
}
