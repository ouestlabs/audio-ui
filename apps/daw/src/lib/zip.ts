import { unzipSync, Zip, ZipPassThrough } from "fflate";

/** A file to put in an archive: its path in it, and its bytes. */
export interface ZipFile {
  data: Blob | Uint8Array<ArrayBuffer> | string;
  path: string;
}

/** A file of an archive read back: its size, and its bytes when asked for. */
export interface ZipEntry {
  read: () => Promise<ArrayBuffer>;
  size: number;
}

const bytesOf = async (data: ZipFile["data"]) => {
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }
  return data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
};

/** An archive of `files`, each stored as it is, under its path; one file is read at a time, so only one is ever held whole. */
export async function createZip(files: readonly ZipFile[]): Promise<Blob> {
  const parts: BlobPart[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) {
      failure = error;
    } else {
      parts.push(chunk as Uint8Array<ArrayBuffer>);
    }
  });
  await files.reduce(async (previous, file) => {
    await previous;
    const entry = new ZipPassThrough(file.path);
    zip.add(entry);
    entry.push(await bytesOf(file.data), true);
  }, Promise.resolve());
  zip.end();
  if (failure) {
    throw failure;
  }
  return new Blob(parts);
}

/** The files of an archive, by their path in it; it throws on what is not a zip. */
export async function readZip(blob: Blob): Promise<Map<string, ZipEntry>> {
  const archive = new Uint8Array(await blob.arrayBuffer());
  const found: { name: string; size: number }[] = [];
  try {
    unzipSync(archive, {
      filter: ({ name, originalSize }) => {
        found.push({ name, size: originalSize });
        return false;
      },
    });
  } catch (error) {
    throw new Error("This is not a zip archive.", { cause: error });
  }
  const entries = new Map<string, ZipEntry>();
  for (const { name, size } of found) {
    if (name.endsWith("/")) {
      continue;
    }
    entries.set(name, {
      read: () => {
        const data = unzipSync(archive, {
          filter: (file) => file.name === name,
        })[name] as Uint8Array;
        return Promise.resolve(
          data.byteLength === data.buffer.byteLength
            ? (data.buffer as ArrayBuffer)
            : data.slice().buffer
        );
      },
      size,
    });
  }
  return entries;
}