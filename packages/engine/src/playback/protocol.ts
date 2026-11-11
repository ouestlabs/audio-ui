import type { PlayedClip } from "./clip.ts";
import type { PageRequest, RecordingStream } from "./stream.ts";
import type { PlaybackState } from "./transport.ts";

/** The name the clip player's processor is registered under in an AudioWorklet. */
export const CLIP_PLAYER_PROCESSOR = "audioui-clip-player";

/**
 * What the main thread posts to a clip player's port. The recordings are kept
 * once for the whole context: every player of the context reads them, so a
 * recording posted through one player is there for all of them.
 */
export type ClipPlayerMessage =
  /** Keeps a decoded recording under `id`, for every player of the context. */
  | {
      channels: Float32Array[];
      id: string;
      sampleRate: number;
      type: "recording";
    }
  /** Keeps a streamed recording under `id`, read from the pages of its stream, for every player of the context. */
  | {
      id: string;
      sampleRate: number;
      stream: RecordingStream;
      type: "stream";
    }
  /** Lets a recording go. */
  | { id: string; type: "forget" }
  /** The track's clips, from the next block on. */
  | { clips: PlayedClip[]; type: "clips" }
  /** A state of the transport, taken over at its frame. */
  | { state: PlaybackState; type: "state" }
  /** Asks the processor to answer `synced` with the same id once it has every message before this one. */
  | { id: number; type: "sync" }
  /** Ends the player: its processor stops being called. */
  | { type: "dispose" };

/** What a clip player's processor posts back. */
export type ClipPlayerReply = { id: number; type: "synced" };

/**
 * What the main thread posts to the loader of streamed recordings, a Worker.
 * A recording's file, in the origin private file system, holds its channels
 * one after the other, each its frames as 32-bit floats at the engine's rate.
 */
export type RecordingLoaderMessage =
  /** Opens a recording's file, at `path` from the root of the origin private file system, and loads its pages into `stream`. */
  | {
      id: string;
      path: readonly string[];
      stream: RecordingStream;
      type: "add";
    }
  /** Lets a recording go: its file is closed and its slots are free. */
  | { id: string; type: "forget" }
  /** Loads the pages asked for that are missing, soonest first; answered with `loaded` and the same id. */
  | { id: number; requests: readonly PageRequest[]; type: "want" };

/** What the loader posts back. */
export type RecordingLoaderReply =
  | { id: number; loaded: number; type: "loaded" }
  /** A recording's file could not be opened: its pages stay silent. */
  | { id: string; message: string; type: "failed" };
