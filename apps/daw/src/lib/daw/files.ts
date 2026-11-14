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

type Part = ArrayBuffer | ArrayBufferView<ArrayBuffer> | Blob | string;

/** What a worker writes a file of the private storage through in place: a `FileSystemSyncAccessHandle`. */
interface InPlace {
  close: () => void;
  flush: () => void;
  truncate: (size: number) => void;
  write: (
    buffer: ArrayBuffer | ArrayBufferView,
    options: { at: number }
  ) => number;
}

/** The bytes of another file read at a time when one is copied in place. */
const COPY_BLOCK = 1 << 23;

/** `part` written at byte `at`, a slice of another file a block at a time; where the next part goes. */
async function writeInPlace(
  access: InPlace,
  part: Part,
  at: number
): Promise<number> {
  if (part instanceof Blob) {
    await Array.from(
      { length: Math.ceil(part.size / COPY_BLOCK) },
      (_, index) => index * COPY_BLOCK
    ).reduce<Promise<void>>(async (copied, from) => {
      await copied;
      access.write(await part.slice(from, from + COPY_BLOCK).arrayBuffer(), {
        at: at + from,
      });
    }, Promise.resolve());
    return at + part.size;
  }
  const bytes =
    typeof part === "string" ? new TextEncoder().encode(part) : part;
  return at + access.write(bytes, { at });
}

/**
 * `parts` written one after the other into `name`, in the private storage's
 * `folder`, which is made when missing. A part can be a function that makes
 * it, called once the one before is written, so a long file is written a block
 * at a time without holding it whole; a `Blob`, such as a slice of another
 * file, is copied without being read here.
 */
export async function writeFile(
  folder: string,
  name: string,
  parts: readonly (Part | (() => Promise<Part>))[]
): Promise<void> {
  const directory = await (
    await navigator.storage.getDirectory()
  ).getDirectoryHandle(folder, { create: true });
  const handle: FileSystemFileHandle & {
    createSyncAccessHandle?: () => Promise<InPlace>;
  } = await directory.getFileHandle(name, { create: true });
  // In a worker, written in place, without the copy a stream writes first: many times faster for a long recording.
  if (handle.createSyncAccessHandle) {
    const access = await handle.createSyncAccessHandle();
    try {
      access.truncate(0);
      await parts.reduce<Promise<number>>(
        async (written, part) =>
          writeInPlace(
            access,
            typeof part === "function" ? await part() : part,
            await written
          ),
        Promise.resolve(0)
      );
      access.flush();
    } finally {
      access.close();
    }
    return;
  }
  const writable = await handle.createWritable();
  // One after the other, in order: a file stream takes them as they come.
  await parts.reduce<Promise<void>>(
    (written, part) =>
      written.then(async () =>
        writable.write(typeof part === "function" ? await part() : part)
      ),
    Promise.resolve()
  );
  await writable.close();
}
