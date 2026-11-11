import { midiToHz } from "@audio/note";
import type { DeviceContext } from "@audio-ui/engine/device";
import type {
  AnyDeviceState,
  LibraryDevice,
  LibraryEngine,
} from "@/lib/device-library";

/** A note to play: its pitch and velocity, 0 to 1, and the instrument's own note parameters it sets over them, such as a pad's frequency and cutoff. */
export interface PlayedNote {
  parameters?: Readonly<Record<string, number>>;
  pitch: number;
  velocity: number;
}

/** What plays a MIDI track's notes, at times of the audio clock in seconds, each note by an id its note off names. */
export interface NotePlayer {
  dispose: () => void;
  /** Lets go of the note `id`. */
  noteOff: (time: number, id: string) => void;
  /** Starts the note `id`; started again while it is held, the voice that holds it follows. */
  noteOn: (note: PlayedNote, time: number, id: string) => void;
  /** Resolves once its engines are in the graph. */
  ready: () => Promise<void>;
  /** Lets go of every note, and takes back what starts after `time`, as a stop does. */
  release: (time: number) => void;
}

/** The note parameters an instrument is given for `note`: its defaults, the pitch's frequency, the velocity, then the note's own. */
export function noteParameters(
  entry: LibraryDevice,
  note: PlayedNote
): Record<string, number> {
  return {
    ...Object.fromEntries(
      entry.device.note.map((parameter) => [parameter.id, parameter.default])
    ),
    frequency: midiToHz(note.pitch),
    velocity: note.velocity,
    ...note.parameters,
  };
}

/** An instrument played by a pool of voices: what `update` changes in all of them. */
export interface VoicePool extends NotePlayer {
  readonly entry: LibraryDevice;
  update: (values: AnyDeviceState, context?: DeviceContext) => void;
}

interface Voice {
  engine: LibraryEngine;
  /** The note it holds, and since when. */
  holding: { id: string; since: number } | null;
}

/** A mono instrument: its one engine takes every note, and lets each go by its id. */
function createMonoPlayer(
  ctx: BaseAudioContext,
  entry: LibraryDevice,
  values: AnyDeviceState,
  context: DeviceContext | undefined,
  output: AudioNode
): VoicePool {
  const engine = entry.create(ctx, values, context);
  engine.output.connect(output);
  const held = new Set<string>();
  return {
    dispose: () => engine.dispose(),
    entry,
    noteOff: (time, id) => {
      if (held.delete(id)) {
        engine.noteOff?.({ at: time, id });
      }
    },
    noteOn: (note, time, id) => {
      held.add(id);
      engine.noteOn?.(noteParameters(entry, note), { at: time, id });
    },
    ready: async () => {
      await engine.ready;
    },
    release: (time) => {
      for (const id of held) {
        engine.noteOff?.({ at: time, id });
      }
      held.clear();
    },
    update: (next, nextContext) => engine.update(next, nextContext),
  };
}

/**
 * An instrument of the library played with `count` voices into `output`, one
 * note each: a new note takes a free voice, or the one held longest. A mono
 * instrument gets one engine, which takes every note.
 */
export function createVoicePool(
  ctx: BaseAudioContext,
  entry: LibraryDevice,
  values: AnyDeviceState,
  context: DeviceContext | undefined,
  count: number,
  output: AudioNode
): VoicePool {
  if (entry.mono) {
    return createMonoPlayer(ctx, entry, values, context, output);
  }
  const voices: Voice[] = Array.from({ length: count }, () => {
    const engine = entry.create(ctx, values, context);
    engine.output.connect(output);
    return { engine, holding: null };
  });

  const noteOff = (time: number, id: string) => {
    const voice = voices.find((item) => item.holding?.id === id);
    if (voice) {
      voice.engine.noteOff?.({ at: time, id });
      voice.holding = null;
    }
  };

  return {
    dispose: () => {
      for (const voice of voices) {
        voice.engine.dispose();
      }
    },
    entry,
    noteOff,
    noteOn: (note, time, id) => {
      // The voice that holds this note already follows it; another takes the oldest one's place.
      const held = voices.find((voice) => voice.holding?.id === id);
      const free =
        held ??
        voices.find((voice) => !voice.holding) ??
        voices.reduce((oldest, voice) =>
          (voice.holding?.since ?? 0) < (oldest.holding?.since ?? 0)
            ? voice
            : oldest
        );
      if (!free) {
        return;
      }
      if (free.holding && free !== held) {
        free.engine.noteOff?.({ at: time, id: free.holding.id });
      }
      free.engine.noteOn?.(noteParameters(entry, note), { at: time, id });
      free.holding = held?.holding ?? { id, since: time };
    },
    ready: async () => {
      await Promise.all(voices.map((voice) => voice.engine.ready));
    },
    release: (time) => {
      for (const voice of voices) {
        if (voice.holding) {
          voice.engine.noteOff?.({ at: time, id: voice.holding.id });
          voice.holding = null;
        }
      }
    },
    update: (next, nextContext) => {
      for (const voice of voices) {
        voice.engine.update(next, nextContext);
      }
    },
  };
}