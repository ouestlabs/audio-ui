import type { DeviceContext } from "@audio-ui/engine/device";
import { midiToHz } from "@audio-ui/engine/pitch";
import type { AnyDeviceState, LibraryDevice } from "@/lib/device-library";
import { createPolyphony } from "@/lib/polyphony";

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
  const engines = Array.from({ length: count }, () => {
    const engine = entry.create(ctx, values, context);
    engine.output.connect(output);
    return engine;
  });
  const voices = createPolyphony(engines);

  return {
    dispose: () => {
      for (const engine of engines) {
        engine.dispose();
      }
    },
    entry,
    noteOff: (time, id) => voices.noteOff(id, time),
    noteOn: (note, time, id) =>
      voices.noteOn(noteParameters(entry, note), id, time),
    ready: async () => {
      await Promise.all(engines.map((engine) => engine.ready));
    },
    release: (time) => voices.release(time),
    update: (next, nextContext) => {
      for (const engine of engines) {
        engine.update(next, nextContext);
      }
    },
  };
}
