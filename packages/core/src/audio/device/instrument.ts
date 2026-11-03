import type { DeviceBinding } from "./define.ts";

/**
 * When a note starts or ends, and which note it is. `at` is a time of the
 * audio clock (a context's `currentTime`), now when there is none: a host
 * that schedules ahead gives the time each note falls at. `id` names the
 * note, so a host that plays several at once ends the right one: a `noteOff`
 * whose `id` is not the held note's lets nothing go.
 */
export interface NoteTiming {
  at?: number;
  id?: number | string;
}

/**
 * What a host gives an instrument to play: a `DeviceBinding` that also takes
 * notes. `Note` is the object the instrument's `note` descriptors describe,
 * a pitch in hertz and a cutoff for instance. `noteOn` starts a note, or moves
 * the one being held to it; `noteOff` lets it go. Both take an optional
 * `NoteTiming`: with none, now, and whichever note is held.
 */
export interface InstrumentBinding<State, Note> extends DeviceBinding<State> {
  noteOff: (timing?: NoteTiming) => void;
  noteOn: (note: Note, timing?: NoteTiming) => void;
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
