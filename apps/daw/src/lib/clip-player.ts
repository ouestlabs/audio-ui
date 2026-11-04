import {
  CLIP_PLAYER_PROCESSOR,
  CLIP_PLAYER_WORKLET,
  type ClipPlayerMessage,
  type ClipPlayerReply,
  type PlaybackState,
  type PlayedClip,
} from "@audio-ui/core/playback";

/** A recording as a player takes it: decoded, or its channels and rate. */
export type RecordingSource =
  | AudioBuffer
  | { channels: readonly Float32Array[]; sampleRate: number };

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
function channelsOf(source: RecordingSource): Float32Array[] {
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
          send({
            channels: channelsOf(recording),
            id: clip.recording,
            sampleRate: recording.sampleRate,
            type: "recording",
          });
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