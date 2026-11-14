/**
 * Runs an operation of the Process menu off the page (`processSource`): the
 * channels it is sent, processed, encoded as a WAV file of floats and
 * measured, all posted back. It encodes with the engine's `encodeAudio` itself: a worker is
 * never in the server's build, which `audio-files` keeps the encoders out of.
 */
import { encodeAudio } from "@audio-ui/engine/files";
import { type Measured, measureSound } from "@/lib/daw/measure";
import { transferable } from "@/lib/daw/samples";
import {
  applySoundOperation,
  type SoundOperation,
} from "@/lib/sound-operations";

/** What the page sends: a clip's source, read, and the operation to run on it. */
export interface ProcessJob {
  channels: Float32Array[];
  operation: SoundOperation;
  sampleRate: number;
}

/** What comes back: the sound processed, the bytes of its file, and its peaks and chroma. */
export interface ProcessDone {
  bytes: ArrayBuffer;
  channels: Float32Array[];
  measured: Measured;
}

self.onmessage = async (event: MessageEvent<ProcessJob>) => {
  const { channels: read, operation, sampleRate } = event.data;
  const { channels } = applySoundOperation(
    { channels: read, sampleRate },
    operation
  );
  const bytes = await (
    await encodeAudio(channels, { bitDepth: 32, format: "wav", sampleRate })
  ).arrayBuffer();
  const measured = measureSound(channels, sampleRate);
  self.postMessage({ bytes, channels, measured } satisfies ProcessDone, {
    transfer: [
      bytes,
      ...transferable(channels),
      measured.peaks.max.buffer as ArrayBuffer,
      measured.peaks.min.buffer as ArrayBuffer,
    ],
  });
};
