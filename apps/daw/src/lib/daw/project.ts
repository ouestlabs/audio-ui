import type { Tempo } from "@audio-ui/core/time";
import type { ArrangementTrack, TrackDevice } from "@/lib/arrangement";
import {
  type ArrangementDoc,
  createArrangementState,
  MAIN_TRACK,
} from "@/lib/arrangement-state";
import { libraryDevice } from "@/lib/device-library";

/** How many colors a track can take: the timeline's palette. */
export const TRACK_COLOR_COUNT = 5;

export const START_TEMPO: Tempo = { beatUnit: 4, beatsPerBar: 4, bpm: 120 };

/** A new project's length: 64 bars of 4/4 at its tempo. */
const START_SECONDS = 64 * 2;

/** A device of the library on a chain, at its own defaults. */
export function deviceAt(id: string, device: string): TrackDevice {
  const entry = libraryDevice(device);
  return {
    device,
    id,
    ...(entry?.device.kind === "instrument" ? { instrument: true } : {}),
    state: entry?.device.defaults() ?? {},
  };
}

/** What a new project holds (ARR-009): two MIDI tracks with a synth, then two audio tracks, a reverb return and a delay return. */
export function newProject(): ArrangementDoc {
  const tracks: ArrangementTrack[] = [
    {
      color: 0,
      devices: [deviceAt("device-1", "audioui.pocket-synth")],
      id: "track-3",
      kind: "midi",
      name: "1 MIDI",
    },
    {
      color: 1,
      devices: [deviceAt("device-2", "audioui.pocket-synth")],
      id: "track-4",
      kind: "midi",
      name: "2 MIDI",
    },
    { color: 2, id: "track-1", kind: "audio", name: "3 Audio" },
    { color: 3, id: "track-2", kind: "audio", name: "4 Audio" },
  ];
  const returns: ArrangementTrack[] = [
    {
      color: 0,
      devices: [deviceAt("device-3", "audioui.reverb")],
      id: "return-1",
      name: "A Reverb",
    },
    {
      color: 1,
      devices: [deviceAt("device-4", "audioui.delay")],
      id: "return-2",
      name: "B Delay",
    },
  ];
  return createArrangementState({
    colors: TRACK_COLOR_COUNT,
    duration: START_SECONDS,
    // The loop waits on the first four bars, off, as the brace of a new arrangement does.
    initialLoop: { on: false, range: [0, 8] },
    initialMain: MAIN_TRACK,
    initialReturns: returns,
    initialTracks: tracks,
    tempo: START_TEMPO,
  }).doc;
}

/**
 * A document with one id per track (ARR-022): one saved when new tracks could
 * take an id there was gets a new id for each track after the first under it.
 * The clips stay on the first, where they showed; the others come back empty.
 */
export function withUniqueTrackIds(doc: ArrangementDoc): ArrangementDoc {
  const taken = new Set(doc.tracks.map((track) => track.id));
  if (taken.size === doc.tracks.length) {
    return doc;
  }
  const seen = new Set<string>();
  const tracks = doc.tracks.map((track) => {
    if (!seen.has(track.id)) {
      seen.add(track.id);
      return track;
    }
    let n = doc.tracks.length + 1;
    while (taken.has(`track-${n}`)) {
      n += 1;
    }
    const id = `track-${n}`;
    taken.add(id);
    return { ...track, id };
  });
  return { ...doc, tracks };
}
