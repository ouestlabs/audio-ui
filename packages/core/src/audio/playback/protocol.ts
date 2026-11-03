import type { PlayedClip } from "./clip.ts";
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
  /** Lets a recording go. */
  | { id: string; type: "forget" }
  /** The track's clips, from the next block on. */
  | { clips: PlayedClip[]; type: "clips" }
  /** A state of the transport, taken over at its frame. */
  | { state: PlaybackState; type: "state" }
  /** Ends the player: its processor stops being called. */
  | { type: "dispose" };
