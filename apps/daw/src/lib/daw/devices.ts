import type { ArrangementTrack, AutomatedParameter } from "@/lib/arrangement";
import {
  type ArrangementCommand,
  type ArrangementDoc,
  allTracks,
  trackOf,
} from "@/lib/arrangement-state";
import { NEW_TRACK } from "@/lib/daw/drop";
import { libraryDevice } from "@/lib/device-library";

/** The first id `track-<n>` no track of the document has. */
function freshTrackId(doc: ArrangementDoc): string {
  const taken = new Set(allTracks(doc).map((track) => track.id));
  let n = 1;
  while (taken.has(`track-${n}`)) {
    n += 1;
  }
  return `track-${n}`;
}

/** Whether the track `id` takes a device: an effect goes on any track, an instrument on a MIDI track only (DEV-002). */
export function takesDevice(
  doc: ArrangementDoc,
  id: string,
  instrument: boolean
): boolean {
  if (!trackOf(doc, id)) {
    return false;
  }
  return (
    !instrument ||
    doc.tracks.some((track) => track.id === id && track.kind === "midi")
  );
}

/** Whether a track has an output: a MIDI track with no instrument has none, so no volume, pan or sends (MIX-024). */
export function hasOutput(track: ArrangementTrack): boolean {
  return (
    track.kind !== "midi" ||
    (track.devices ?? []).some((device) => device.instrument)
  );
}

/**
 * The parameter a track's lane shows in automation mode: the one `shown`, or
 * for a track with no output, whose volume and pan are gone (MIX-024), its
 * first device parameter. Null when there is none to show.
 */
export function automatedParameter(
  track: ArrangementTrack,
  shown: AutomatedParameter,
  targets: readonly { key: AutomatedParameter }[] = []
): AutomatedParameter | null {
  if (hasOutput(track) || (shown !== "volume" && shown !== "pan")) {
    return shown;
  }
  return targets[0]?.key ?? null;
}

/**
 * What adding the library's device `device` asks of the arrangement
 * (DEV-003), as one command, so one step of undo. It goes on the chain of
 * `onto`, at its end or at `index`, when that track takes it; otherwise, and
 * on the add-track button (`NEW_TRACK`) or with no track, on a new track named
 * after it, a MIDI track for an instrument and an audio track for an effect,
 * after `onto` when that is a track. `track` is where it goes; null for a
 * device the library does not have.
 */
export function addDeviceCommand(
  doc: ArrangementDoc,
  device: string,
  onto: string | null,
  index?: number
): { command: ArrangementCommand; track: string } | null {
  const entry = libraryDevice(device);
  if (!entry) {
    return null;
  }
  const instrument = entry.device.kind === "instrument";
  const add = (to: string, at?: number): ArrangementCommand => ({
    device,
    index: at,
    instrument,
    state: entry.device.defaults(),
    track: to,
    type: "add-device",
  });
  if (onto && onto !== NEW_TRACK && takesDevice(doc, onto, instrument)) {
    return { command: add(onto, index), track: onto };
  }
  const track = freshTrackId(doc);
  const afterId = doc.tracks.some((item) => item.id === onto)
    ? (onto ?? undefined)
    : undefined;
  return {
    command: {
      commands: [
        {
          afterId,
          id: track,
          kind: instrument ? "midi" : "audio",
          name: entry.device.name,
          type: "add-track",
        },
        add(track),
      ],
      type: "batch",
    },
    track,
  };
}
