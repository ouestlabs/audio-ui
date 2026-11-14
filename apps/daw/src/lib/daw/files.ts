/**
 * Where the project keeps its files in the browser's private storage, and
 * writing one there: what the page and its workers share, so nothing here
 * touches the page. The bytes of each recording as it was dropped go in
 * `recordings/<id>`; what the engine streams in `cache/` (see `cache.ts`).
 */

/** The folder of the decoded audio the engine streams. */
export const CACHE = "cache";
/** The folder of each recording's bytes, as they were dropped. */
export const RECORDINGS = "recordings";

/** What a recording's cache keeps beside its samples. */
export interface CacheEntry {
  channels: number;
  length: number;
  sampleRate: number;
}

/**
 * The files of a recording's cache: its channels as 32-bit floats one after
 * the other, its peaks (the highest, then the lowest), the leaves its waveform
 * is drawn from on the GPU, and what it takes to read it again.
 */
export const cacheNames = (id: string) => ({
  entry: `${id}.json`,
  leaves: `${id}.leaves`,
  range: `${id}.range`,
  samples: `${id}.f32`,
});

/** `parts` written one after the other into `name`, in the private storage's `folder`, which is made when missing. */
export async function writeFile(
  folder: string,
  name: string,
  parts: readonly (ArrayBuffer | ArrayBufferView<ArrayBuffer> | Blob | string)[]
): Promise<void> {
  const directory = await (
    await navigator.storage.getDirectory()
  ).getDirectoryHandle(folder, { create: true });
  const writable = await (
    await directory.getFileHandle(name, { create: true })
  ).createWritable();
  // One after the other, in order: a file stream takes them as they come.
  await parts.reduce<Promise<void>>(
    (written, part) => written.then(() => writable.write(part)),
    Promise.resolve()
  );
  await writable.close();
}
