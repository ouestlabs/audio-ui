import {
  CLIP_PLAYER_PROCESSOR,
  CLIP_PLAYER_WORKLET,
  type ClipPlayerMessage,
  type ClipPlayerReply,
  createPagePool,
  createRecordingStream,
  type PagePool,
  type PageRequest,
  type PlannedRecording,
  type PlaybackState,
  type PlayedClip,
  RECORDING_LOADER_WORKER,
  type RecordingLoaderMessage,
  type RecordingLoaderReply,
  type RecordingStream,
} from "@audio-ui/core/playback";

/**
 * A recording kept in a file of the origin private file system and streamed
 * from it, never decoded whole into memory: `path` from the root, the file
 * holding its channels one after the other as 32-bit floats at the engine's
 * rate, `length` frames each.
 */
export interface StreamedSource {
  channels: number;
  length: number;
  path: readonly string[];
  sampleRate: number;
}

/** A recording as a player takes it: decoded, its channels and rate, or streamed from a file. */
export type RecordingSource =
  | AudioBuffer
  | { channels: readonly Float32Array[]; sampleRate: number }
  | StreamedSource;

/** How many pages the streamed recordings of a page share: 512 of 32,768 stereo frames, 128 MB. */
const STREAM_PAGES = 512;

/** The pool streamed recordings share, the worker that fills it, and each recording's stream. */
interface Streamer {
  asked: number;
  pool: PagePool;
  streams: Map<string, { rate: number; stream: RecordingStream }>;
  waiting: Map<number, () => void>;
  worker: Worker;
}

let streamer: Streamer | null = null;

/** The page's streamer, started the first time a streamed recording is played. */
function streamerOf(): Streamer {
  if (streamer) {
    return streamer;
  }
  const url = URL.createObjectURL(
    new Blob([RECORDING_LOADER_WORKER], { type: "text/javascript" })
  );
  const worker = new Worker(url, { type: "module" });
  URL.revokeObjectURL(url);
  const made: Streamer = {
    asked: 0,
    pool: createPagePool(STREAM_PAGES),
    streams: new Map(),
    waiting: new Map(),
    worker,
  };
  worker.onmessage = (event: MessageEvent<RecordingLoaderReply>) => {
    const reply = event.data;
    if (reply.type === "loaded") {
      made.waiting.get(reply.id)?.();
      made.waiting.delete(reply.id);
    }
  };
  streamer = made;
  return made;
}

const isStreamed = (source: RecordingSource): source is StreamedSource =>
  "path" in source;

/** A streamed recording's stream, made and handed to the loader the first time it is played. */
function streamOf(id: string, source: StreamedSource): RecordingStream {
  const { pool, streams, worker } = streamerOf();
  const kept = streams.get(id);
  if (kept) {
    return kept.stream;
  }
  const stream = createRecordingStream(pool, source.channels, source.length);
  streams.set(id, { rate: source.sampleRate, stream });
  worker.postMessage({
    id,
    path: source.path,
    stream,
    type: "add",
  } satisfies RecordingLoaderMessage);
  return stream;
}

/** What the planner needs of a recording streamed on this page: its rate and length; nothing for one decoded in memory. */
export function streamedRecording(id: string): PlannedRecording | undefined {
  const kept = streamer?.streams.get(id);
  return kept
    ? { length: kept.stream.length, sampleRate: kept.rate }
    : undefined;
}

/** Loads the pages of streamed recordings asked for, soonest first; resolves once they are in. */
export function wantPages(requests: readonly PageRequest[]): Promise<void> {
  if (!streamer || requests.length === 0) {
    return Promise.resolve();
  }
  const { waiting, worker } = streamer;
  streamer.asked += 1;
  const id = streamer.asked;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    worker.postMessage({
      id,
      requests,
      type: "want",
    } satisfies RecordingLoaderMessage);
  });
}

export interface ClipPlayer {
  /** Lets the player go: it stops being rendered and leaves the graph. */
  dispose: () => void;
  /** The track's sound, in stereo: connect it to the track's chain. */
  readonly output: AudioNode;
  /** A state of the transport, taken over at its own frame of the clock. */
  schedule: (state: PlaybackState) => void;
  /**
   * The clips the track plays from the next block on. The recordings they
   * name are posted the first time a player of the context needs them, and
   * kept for all of its players.
   */
  setClips: (
    clips: readonly PlayedClip[],
    recordings: ReadonlyMap<string, RecordingSource>
  ) => void;
  /**
   * Resolves once the player has every message sent before it: what an
   * offline render waits for before it starts, so nothing it was told arrives
   * after the frames it was meant for.
   */
  synced: () => Promise<void>;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();
/** The recordings each context's players already hold. */
const posted = new WeakMap<BaseAudioContext, Set<string>>();
/** A recording's channels in shared memory, made once, so every context reads the same samples. */
const shared = new WeakMap<object, Float32Array[]>();

/**
 * Loads the clip player into a context once: an AudioWorklet registered as
 * `CLIP_PLAYER_PROCESSOR`. `false` when the context cannot run worklets.
 */
export function loadClipPlayer(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  const worklet = ctx.audioWorklet;
  if (!(worklet && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([CLIP_PLAYER_WORKLET], { type: "text/javascript" })
  );
  const done = worklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A recording's channels, ready to post: in a page that is cross-origin
 * isolated, copied once into shared memory, so the players of every context
 * (the one that plays, the one that renders a file) read the same samples
 * instead of a copy each.
 */
function channelsOf(
  source: AudioBuffer | { channels: readonly Float32Array[] }
): Float32Array[] {
  const channels =
    "getChannelData" in source
      ? Array.from({ length: source.numberOfChannels }, (_, channel) =>
          source.getChannelData(channel)
        )
      : [...source.channels];
  if (!globalThis.crossOriginIsolated) {
    return channels;
  }
  const kept = shared.get(source);
  if (kept) {
    return kept;
  }
  const copies = channels.map((channel) => {
    const copy = new Float32Array(new SharedArrayBuffer(channel.byteLength));
    copy.set(channel);
    return copy;
  });
  shared.set(source, copies);
  return copies;
}

/**
 * A track's player on a context where `loadClipPlayer` resolved to `true`:
 * an AudioWorkletNode with no input and a stereo output, which plays the
 * track's audio clips from the recordings it is given, on the audio clock.
 */
export function createClipPlayer(ctx: BaseAudioContext): ClipPlayer {
  const node = new AudioWorkletNode(ctx, CLIP_PLAYER_PROCESSOR, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const send = (message: ClipPlayerMessage) => node.port.postMessage(message);
  const waiting = new Map<number, () => void>();
  let syncs = 0;
  node.port.onmessage = (event: MessageEvent<ClipPlayerReply>) => {
    waiting.get(event.data.id)?.();
    waiting.delete(event.data.id);
  };
  const held = posted.get(ctx) ?? new Set<string>();
  posted.set(ctx, held);
  return {
    dispose: () => {
      send({ type: "dispose" });
      node.disconnect();
      node.port.close();
    },
    output: node,
    schedule: (state) => send({ state, type: "state" }),
    setClips: (clips, recordings) => {
      for (const clip of clips) {
        const recording = recordings.get(clip.recording);
        if (recording && !held.has(clip.recording)) {
          held.add(clip.recording);
          send(
            isStreamed(recording)
              ? {
                  id: clip.recording,
                  sampleRate: recording.sampleRate,
                  stream: streamOf(clip.recording, recording),
                  type: "stream",
                }
              : {
                  channels: channelsOf(recording),
                  id: clip.recording,
                  sampleRate: recording.sampleRate,
                  type: "recording",
                }
          );
        }
      }
      send({ clips: [...clips], type: "clips" });
    },
    synced: () =>
      new Promise((resolve) => {
        syncs += 1;
        waiting.set(syncs, resolve);
        send({ id: syncs, type: "sync" });
      }),
  };
}

/** Lets a recording go from a context's players, once no clip plays it. */
export function forgetRecording(
  player: ClipPlayer,
  ctx: BaseAudioContext,
  id: string
) {
  const held = posted.get(ctx);
  if (held?.delete(id)) {
    (player.output as AudioWorkletNode).port.postMessage({
      id,
      type: "forget",
    } satisfies ClipPlayerMessage);
  }
}
