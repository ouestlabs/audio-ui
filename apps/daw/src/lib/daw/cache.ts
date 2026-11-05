/**
 * The decoded audio the engine streams (G-013, PRF-006), in the browser's
 * private storage: each recording's channels at the engine's rate, as 32-bit
 * floats one channel after the other, in `cache/<id>.f32`, its peaks the same
 * way, the highest then the lowest, in `cache/<id>.range`, and what it takes to read it again without
 * decoding, in `cache/<id>.json`. It is made from the
 * dropped file's bytes, and made again from them when it is missing.
 */
import type { StreamedSource } from "@/lib/clip-player";
import type { Recording } from "@/lib/daw/recordings";
import { canStore } from "@/lib/daw/storage";

const CACHE = "cache";

/** What a recording's cache keeps beside its samples. */
interface CacheEntry {
  channels: number;
  length: number;
  sampleRate: number;
}

/** Whether recordings can be streamed here: shared memory, a worker and the private storage. */
export function canStream(): boolean {
  return (
    Boolean(globalThis.crossOriginIsolated) &&
    typeof Worker !== "undefined" &&
    canStore()
  );
}

const folderOf = async () =>
  (await navigator.storage.getDirectory()).getDirectoryHandle(CACHE, {
    create: true,
  });

const sourceOf = (id: string, entry: CacheEntry): StreamedSource => ({
  channels: entry.channels,
  length: entry.length,
  path: [CACHE, `${id}.f32`],
  sampleRate: entry.sampleRate,
});

/**
 * Writes a decoded recording's cache and gives it back streamed from there:
 * once this resolves, nothing holds its decoded channels and they can go.
 */
export async function streamRecording(
  id: string,
  recording: Recording
): Promise<Recording> {
  const { source } = recording;
  if (!("channels" in source && Array.isArray(source.channels))) {
    return recording;
  }
  const channels = source.channels as readonly Float32Array[];
  const folder = await folderOf();
  const samples = await (
    await folder.getFileHandle(`${id}.f32`, { create: true })
  ).createWritable();
  await channels.reduce(async (written, channel) => {
    await written;
    // A file is written from memory of its own: channels in shared memory are copied first.
    await samples.write(
      channel.buffer instanceof ArrayBuffer
        ? (channel as Float32Array<ArrayBuffer>)
        : new Float32Array(channel)
    );
  }, Promise.resolve());
  await samples.close();
  const entry: CacheEntry = {
    channels: channels.length,
    length: channels[0]?.length ?? 0,
    sampleRate: source.sampleRate,
  };
  const peaks = await (
    await folder.getFileHandle(`${id}.range`, { create: true })
  ).createWritable();
  await peaks.write(recording.peaks.max as Float32Array<ArrayBuffer>);
  await peaks.write(recording.peaks.min as Float32Array<ArrayBuffer>);
  await peaks.close();
  // A level of amplitudes from before there were two, which nothing reads now.
  await folder.removeEntry(`${id}.peaks`).catch(() => undefined);
  const meta = await (
    await folder.getFileHandle(`${id}.json`, { create: true })
  ).createWritable();
  await meta.write(JSON.stringify(entry));
  await meta.close();
  return { ...recording, source: sourceOf(id, entry) };
}

/** A recording read back from its cache, when there is one at the engine's rate; null otherwise. */
export async function cachedRecording(
  id: string,
  name: string,
  sampleRate: number
): Promise<Recording | null> {
  try {
    const folder = await folderOf();
    const entry = JSON.parse(
      await (await (await folder.getFileHandle(`${id}.json`)).getFile()).text()
    ) as CacheEntry;
    const samples = await (await folder.getFileHandle(`${id}.f32`)).getFile();
    // A cache made before peaks had this file is missing it: made again, it draws the sound as it is.
    const range = new Float32Array(
      await (
        await (await folder.getFileHandle(`${id}.range`)).getFile()
      ).arrayBuffer()
    );
    if (
      entry.sampleRate !== sampleRate ||
      samples.size !==
        entry.channels * entry.length * Float32Array.BYTES_PER_ELEMENT
    ) {
      return null;
    }
    return {
      length: entry.length / entry.sampleRate,
      name,
      peaks: {
        max: range.subarray(0, range.length / 2),
        min: range.subarray(range.length / 2),
      },
      source: sourceOf(id, entry),
    };
  } catch {
    return null;
  }
}

/** Lets go of the caches of recordings the project no longer has: run before any is streamed, while nothing holds their files open. */
export async function pruneCache(kept: ReadonlySet<string>): Promise<void> {
  try {
    const folder = await folderOf();
    const names = await Array.fromAsync(folder.keys());
    await Promise.all(
      names
        .filter((name) => !kept.has(name.slice(0, name.lastIndexOf("."))))
        .map((name) => folder.removeEntry(name).catch(() => undefined))
    );
  } catch {
    // Nothing cached yet.
  }
}
