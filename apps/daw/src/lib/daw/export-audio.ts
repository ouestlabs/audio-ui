/**
 * The registry's `encodeAudio` and `exportSound`, kept out of the server's
 * build: the page is prerendered and the server never encodes, and with them
 * in its build the Worker would carry every codec.
 */
import { createClientOnlyFn } from "@tanstack/react-start";
import { encodeAudio as encode } from "@/lib/audio-encode";
import { exportSound as exportFrom } from "@/lib/audio-export";

/** `encodeAudio`, in the browser only: a take and a consolidated stretch become WAV files through it. */
export const encodeAudio = createClientOnlyFn(encode);

/** `exportSound`, in the browser only: what the export dialog's settings turn a render into (EXP-003, EXP-005). */
export const exportSound = createClientOnlyFn(exportFrom);
