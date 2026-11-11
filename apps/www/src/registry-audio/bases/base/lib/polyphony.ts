import type { NoteTiming } from "@audio-ui/engine/device";

/** What a voice plays a note on: the engine of an instrument, which holds one note at a time. */
export interface VoiceEngine<Note> {
  noteOff?: (timing?: NoteTiming) => void;
  noteOn?: (note: Note, timing?: NoteTiming) => void;
}

/** Notes played as chords on engines that hold one note each, every note by an id its note off gives again. */
export interface Polyphony<Note> {
  /** Lets go of the note `id`, at `at` on the audio clock or now. A note no voice holds lets nothing go. */
  noteOff: (id: string, at?: number) => void;
  /**
   * Starts the note `id`, at `at` on the audio clock or now: on the voice that
   * holds it already (it follows the new note), else a free one, else the one
   * held longest, whose note is let go first.
   */
  noteOn: (note: Note, id: string, at?: number) => void;
  /** Lets go of every note held, as a stop does. */
  release: (at?: number) => void;
}

/**
 * Plays chords on `engines`, one note each: what turns an instrument whose
 * engine plays one voice into a polyphonic one. It makes no sound and no
 * engine of its own, so it takes the engines already connected, and orders
 * the notes held by when they came, not by a clock.
 */
export function createPolyphony<Note>(
  engines: readonly VoiceEngine<Note>[]
): Polyphony<Note> {
  /** The note each voice holds, by its index, and when it came. */
  const holding: ({ id: string; order: number } | null)[] = engines.map(
    () => null
  );
  let came = 0;
  const timing = (id: string, at?: number): NoteTiming =>
    at === undefined ? { id } : { at, id };

  /** The voice that holds the note `id`, -1 when none does. */
  const holderOf = (id: string) =>
    holding.findIndex((voice) => voice?.id === id);

  /** The voice whose note came first, -1 when none holds one. */
  const oldest = () => {
    let found = -1;
    let first = Number.POSITIVE_INFINITY;
    for (const [index, held] of holding.entries()) {
      if (held && held.order < first) {
        found = index;
        first = held.order;
      }
    }
    return found;
  };

  const noteOff = (id: string, at?: number) => {
    const index = holderOf(id);
    if (index === -1) {
      return;
    }
    engines[index]?.noteOff?.(timing(id, at));
    holding[index] = null;
  };

  return {
    noteOff,
    noteOn: (note, id, at) => {
      let index = holderOf(id);
      if (index === -1) {
        index = holding.indexOf(null);
      }
      if (index === -1) {
        index = oldest();
      }
      const engine = engines[index];
      if (!engine) {
        return;
      }
      const held = holding[index];
      if (held && held.id !== id) {
        engine.noteOff?.(timing(held.id, at));
      }
      engine.noteOn?.(note, timing(id, at));
      if (held?.id !== id) {
        came += 1;
        holding[index] = { id, order: came };
      }
    },
    release: (at) => {
      for (const held of holding) {
        if (held) {
          noteOff(held.id, at);
        }
      }
    },
  };
}
