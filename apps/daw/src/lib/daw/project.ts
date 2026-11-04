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

/** What a new project holds (ARR-009): two audio tracks, two MIDI tracks with a synth, a reverb return and a delay return. */
export function newProject(): ArrangementDoc {
  const tracks: ArrangementTrack[] = [
    { color: 0, id: "track-1", kind: "audio", name: "1 Audio" },
    { color: 1, id: "track-2", kind: "audio", name: "2 Audio" },
    {
      color: 2,
      devices: [deviceAt("device-1", "audioui.pocket-synth")],
      id: "track-3",
      kind: "midi",
      name: "3 MIDI",
    },
    {
      color: 3,
      devices: [deviceAt("device-2", "audioui.pocket-synth")],
      id: "track-4",
      kind: "midi",
      name: "4 MIDI",
    },
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
