/**
 * What the DAW writes to files (EXP-003), through the registry's
 * `audio-encode`: the settings of an export, and the encoder kept out of the
 * server's build. The page is prerendered and the server never encodes; with
 * the encoder in its build, the Worker would carry every codec.
 */
import { createClientOnlyFn } from "@tanstack/react-start";
import {
  type AudioFileFormat,
  type EncodeAudioOptions,
  encodeAudio as encode,
} from "@/lib/audio-encode";

/** What an export writes: WAV and FLAC at 24 bits, MP3 at 320 kbps. */
export const EXPORT_OPTIONS: Record<
  AudioFileFormat,
  Pick<EncodeAudioOptions, "bitDepth" | "bitrate">
> = {
  flac: { bitDepth: 24 },
  mp3: { bitrate: 320 },
  wav: { bitDepth: 24 },
};

/** The registry's `encodeAudio`, in the browser only. */
export const encodeAudio = createClientOnlyFn(encode);
