import type { DeviceBinding } from "./define.ts";

/**
 * What a host gives an instrument to play: a `DeviceBinding` that also takes
 * notes. `Note` is the object the instrument's `note` descriptors describe,
 * a pitch in hertz and a cutoff for instance. `noteOn` starts a note, or moves
 * the one being held to it; `noteOff` lets it go.
 */
export interface InstrumentBinding<State, Note> extends DeviceBinding<State> {
  noteOff: () => void;
  noteOn: (note: Note) => void;
}

/**
 * Plays a note for `seconds` on an instrument: `noteOn` now, `noteOff` when the
 * time is up. What the `<id>_play` tool asks of a host, in one call. Returns a
 * function that lets the note go early. Nothing here knows which clock it is:
 * the page's timer starts it, and a host with a sample-accurate clock of its own
 * keeps `noteOn` and `noteOff` and schedules them itself.
 */
export function playNote<Note>(
  instrument: Pick<InstrumentBinding<unknown, Note>, "noteOff" | "noteOn">,
  note: Note,
  seconds: number
): () => void {
  instrument.noteOn(note);
  let held = true;
  const release = () => {
    if (held) {
      held = false;
      instrument.noteOff();
    }
  };
  const timer = setTimeout(release, seconds * 1000);
  return () => {
    clearTimeout(timer);
    release();
  };
}

/**
 * What a host gives a device that takes a key signal: a `DeviceBinding` whose
 * engine has a second input, `sidechain`, that the key is connected to. It is
 * the shape of an audio engine, so it names no node type: `Input` is the node
 * of the host's audio API, such as an `AudioNode` on the Web Audio API.
 */
export interface SidechainBinding<State, Input> extends DeviceBinding<State> {
  /** Connect the signal that opens, closes or ducks the device here. */
  readonly sidechain: Input;
}
