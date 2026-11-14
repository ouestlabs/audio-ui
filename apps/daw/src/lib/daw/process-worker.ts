/**
 * Runs an operation of the Process menu off the page (`processSource`). A
 * recording held in memory is sent, processed, measured and encoded as a WAV
 * file of floats, all posted back. A streamed one is read here from its cache
 * file, processed, and written as a cache of its own beside it (its samples,
 * peaks, leaves and entry), which the page then streams; its WAV file, what
 * the project keeps it by, is encoded and stored after, while the page goes
 * on. It encodes with the engine's `encodeAudio` itself: a worker is never in
 * the server's build, which `audio-files` keeps the encoders out of.
 */
import { encodeAudio } from "@audio-ui/engine/files";
import type { StreamedSource } from "@/lib/clip-player";
import {
  CACHE,
  type CacheEntry,
  cacheNames,
  RECORDINGS,
  writeFile,
} from "@/lib/daw/files";
import { type Measured, measurePeaks, measureSound } from "@/lib/daw/measure";
import { makeLeaves, readChannels, transferable } from "@/lib/daw/samples";
import {
  applySoundOperation,
  type SoundOperation,
  type SoundRange,
} from "@/lib/sound-operations";

/** A recording held in memory: the clip's source, read, and the operation to run on it, on `range` of it or on all of it. */
export interface MemoryJob {
  channels: Float32Array[];
  kind: "memory";
  operation: SoundOperation;
  range: SoundRange | null;
  sampleRate: number;
}

/** A streamed recording: the frames of it the clip reads (`window`), the operation, and the id of the recording it makes. */
export interface StreamedJob {
  id: string;
  kind: "streamed";
  operation: SoundOperation;
  range: SoundRange | null;
  source: StreamedSource;
  window: readonly [number, number];
}

export type ProcessJob = MemoryJob | StreamedJob;

/** What comes back: from memory, the sound and its file's bytes; streamed, its cache made, then its file stored; or why it failed. */
export type ProcessDone =
  | {
      bytes: ArrayBuffer;
      channels: Float32Array[];
      kind: "memory";
      measured: Measured;
    }
  | { entry: CacheEntry; kind: "made" }
  | { kind: "saved" }
  | { kind: "failed"; message: string };

const post = (done: ProcessDone, transfer: Transferable[] = []) =>
  self.postMessage(done, { transfer });

const wav = (channels: Float32Array[], sampleRate: number) =>
  encodeAudio(channels, { bitDepth: 32, format: "wav", sampleRate });

async function inMemory({
  channels: read,
  operation,
  range,
  sampleRate,
}: MemoryJob) {
  const { channels } = applySoundOperation(
    { channels: read, sampleRate },
    operation,
    range ?? undefined
  );
  const bytes = await (await wav(channels, sampleRate)).arrayBuffer();
  const measured = measureSound(channels, sampleRate);
  post({ bytes, channels, kind: "memory", measured }, [
    bytes,
    ...transferable(channels),
    measured.peaks.max.buffer as ArrayBuffer,
    measured.peaks.min.buffer as ArrayBuffer,
  ]);
}

async function streamed({ id, operation, range, source, window }: StreamedJob) {
  const { sampleRate } = source;
  const { channels } = applySoundOperation(
    {
      channels: await readChannels(source, window[0], window[1]),
      sampleRate,
    },
    operation,
    range ?? undefined
  );
  const length = channels[0]?.length ?? 0;
  const peaks = measurePeaks(channels, sampleRate);
  const leaves = await makeLeaves(
    channels.length,
    length,
    sampleRate,
    (from, to) => channels.map((channel) => channel.subarray(from, to))
  );
  const names = cacheNames(id);
  const entry: CacheEntry = { channels: channels.length, length, sampleRate };
  await Promise.all([
    writeFile(CACHE, names.samples, channels as Float32Array<ArrayBuffer>[]),
    writeFile(CACHE, names.range, [
      peaks.max as Float32Array<ArrayBuffer>,
      peaks.min as Float32Array<ArrayBuffer>,
    ]),
    writeFile(CACHE, names.leaves, [leaves]),
  ]);
  // Last: with its entry there, the cache is whole and the page reads it.
  await writeFile(CACHE, names.entry, [JSON.stringify(entry)]);
  post({ entry, kind: "made" });
  await writeFile(RECORDINGS, id, [await wav(channels, sampleRate)]);
  post({ kind: "saved" });
}

self.onmessage = async (event: MessageEvent<ProcessJob>) => {
  try {
    await (event.data.kind === "memory"
      ? inMemory(event.data)
      : streamed(event.data));
  } catch (error) {
    post({ kind: "failed", message: (error as Error).message });
  }
};
