import type { EngineFactory, InstrumentEngine } from "@audio-ui/engine/device";
import { useCallback, useMemo } from "react";
import {
  type DeviceEngineLike,
  useDeviceEngines,
} from "@/registry-audio/bases/base/hooks/use-device-engines";
import { createPolyphony } from "@/registry-audio/bases/base/lib/polyphony";

/** What a voice needs of an instrument's engine: it plays one note at a time. */
export type PolyphonyEngine<State> = DeviceEngineLike<State> &
  Pick<InstrumentEngine<State, never>, "noteOff" | "noteOn">;

/** The note an engine plays, as its `noteOn` takes it. */
type NoteOf<Engine extends PolyphonyEngine<never>> = Parameters<
  Engine["noteOn"]
>[0];

export interface UsePolyphonyOptions<State, Engine> {
  /** Makes the engine of one voice for the state it starts with: an instrument's `create<Name>Engine`. */
  create: EngineFactory<State, Engine>;
  /** Where every voice plays, such as the node of `useMasterBus`. The voices are made on its context once it is there. */
  destination: AudioNode | null;
  /** The instrument's state: every voice follows it, whoever changed it. */
  state: State;
  /** How many notes sound at once: one more takes the voice held longest. @default 8 */
  voices?: number;
}

export interface UsePolyphonyReturn<Note, Engine> {
  /** The engine of each voice, empty until the destination is there: to give them all the same thing, such as a sample to play. */
  engines: readonly Engine[];
  /** Lets go of the note `id`. */
  noteOff: (id: string) => void;
  /** Starts the note `id` now, on a voice of its own: the one that holds it, a free one, or the one held longest. */
  noteOn: (note: Note, id: string) => void;
}

/**
 * An instrument whose engine plays one voice, played as chords: `voices`
 * engines made into `destination` (`useDeviceEngines`), each note on a voice
 * of its own (`createPolyphony`). Every voice follows `state`, and all are
 * disposed when the destination changes and on unmount. Until the
 * destination is there, notes play nowhere.
 */
export function usePolyphony<State, Engine extends PolyphonyEngine<State>>({
  create,
  destination,
  state,
  voices = 8,
}: UsePolyphonyOptions<State, Engine>): UsePolyphonyReturn<
  NoteOf<Engine>,
  Engine
> {
  const engines = useDeviceEngines({
    count: voices,
    create,
    destination,
    state,
  });
  const polyphony = useMemo(
    () => createPolyphony<NoteOf<Engine>>(engines),
    [engines]
  );
  const noteOn = useCallback(
    (note: NoteOf<Engine>, id: string) => polyphony.noteOn(note, id),
    [polyphony]
  );
  const noteOff = useCallback(
    (id: string) => polyphony.noteOff(id),
    [polyphony]
  );
  return { engines, noteOff, noteOn };
}
