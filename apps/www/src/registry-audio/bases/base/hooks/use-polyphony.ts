"use client";

import type { NoteTiming } from "@audio-ui/core/device";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createPolyphony,
  type Polyphony,
} from "@/registry-audio/bases/base/lib/polyphony";

/** What a voice needs of an instrument's engine: it plays one note, follows a state, and lets go. */
export interface PolyphonyEngine<State> {
  dispose: () => void;
  noteOff: (timing?: NoteTiming) => void;
  /** The engine's own note, such as `{ frequency, velocity }`: `never` here, so any note type fits. */
  noteOn: (note: never, timing?: NoteTiming) => void;
  readonly output: AudioNode;
  update: (state: State) => void;
}

/** The note an engine plays, as its `noteOn` takes it. */
type NoteOf<Engine extends PolyphonyEngine<never>> = Parameters<
  Engine["noteOn"]
>[0];

export interface UsePolyphonyOptions<State, Engine> {
  /** Makes the engine of one voice for the state it starts with: an instrument's `create…Engine`. */
  create: (ctx: BaseAudioContext, state: State) => Engine;
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

const NO_ENGINES: readonly never[] = [];

/** A set of voices: the engines, and what gives each note one. */
interface Voices<Engine extends PolyphonyEngine<never>> {
  engines: readonly Engine[];
  polyphony: Polyphony<NoteOf<Engine>>;
}

/**
 * An instrument whose engine plays one voice, played as chords: `voices`
 * engines made into `destination`, each note on a voice of its own
 * (`createPolyphony`). Every voice follows `state`, and all are disposed when
 * the destination changes and on unmount. Until the destination is there,
 * notes play nowhere. `noteOn` and `noteOff` keep their identity across
 * renders and always reach the voices playing now.
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
  const [made, setMade] = useState<Voices<Engine> | null>(null);
  /** The voices playing now: the ones a render holds may have just been disposed for a new destination. */
  const live = useRef<Voices<Engine> | null>(null);
  // The voices start from the state they are made with; the effect below keeps them following it.
  const stateRef = useRef(state);
  stateRef.current = state;
  const createRef = useRef(create);
  createRef.current = create;

  useEffect(() => {
    if (!destination) {
      return;
    }
    const engines = Array.from({ length: voices }, () => {
      const engine = createRef.current(destination.context, stateRef.current);
      engine.output.connect(destination);
      return engine;
    });
    const next = {
      engines,
      polyphony: createPolyphony<NoteOf<Engine>>(engines),
    };
    live.current = next;
    setMade(next);
    return () => {
      live.current = null;
      for (const engine of engines) {
        engine.dispose();
      }
      setMade(null);
    };
  }, [destination, voices]);

  useEffect(() => {
    // A new destination and a new state can come in one render: the voices it holds are then gone.
    if (made !== live.current) {
      return;
    }
    for (const engine of made?.engines ?? NO_ENGINES) {
      engine.update(state);
    }
  }, [made, state]);

  const noteOn = useCallback(
    (note: NoteOf<Engine>, id: string) =>
      live.current?.polyphony.noteOn(note, id),
    []
  );
  const noteOff = useCallback(
    (id: string) => live.current?.polyphony.noteOff(id),
    []
  );

  return { engines: made?.engines ?? NO_ENGINES, noteOff, noteOn };
}
