/**
 * The registry's audio file functions, kept out of the server's build: the
 * page is prerendered and the server never decodes or encodes, and with them
 * in its build the Worker would carry every decoder and encoder.
 */
import { createClientOnlyFn } from "@tanstack/react-start";
import { decodeAudioChannels as decode } from "@/lib/audio-decode";
import { encodeAudio as encode } from "@/lib/audio-encode";
import { exportSound as exportFrom } from "@/lib/audio-export";

/** `decodeAudioChannels`, in the browser only: what a dropped or opened file is read through, in any format a browser or `@audio/decode` reads (ARR-007). */
export const decodeAudioChannels = createClientOnlyFn(decode);

/** `encodeAudio`, in the browser only: a take and a consolidated stretch become WAV files through it. */
export const encodeAudio = createClientOnlyFn(encode);

/** `exportSound`, in the browser only: what the export dialog's settings turn a render into (EXP-003, EXP-005). */
export const exportSound = createClientOnlyFn(exportFrom);
