/**
 * Opening and saving a project folder of the disk (PRJ-007), where the
 * browser lets a page write to a folder the user picks (Chromium). The folder
 * a project belongs to is remembered across reloads; writing to it again asks
 * the browser's leave once per visit.
 */
import type { ArrangementDoc } from "@/lib/arrangement-state";
import {
  PROJECT_EXTENSION,
  type ProjectFile,
  type ProjectSample,
  readProjectFile,
  SAMPLES,
  sampleFileName,
  savedAs,
  sniffExtension,
  writeProjectFile,
} from "@/lib/daw/project-file";

/** What the DOM library leaves out: the folder picker, and asking for the leave to write. */
interface FolderAccess {
  showDirectoryPicker: (options: {
    id?: string;
    mode: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
}
type Permissions = FileSystemDirectoryHandle & {
  queryPermission: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission: (options: {
    mode: "readwrite";
  }) => Promise<PermissionState>;
};

const DATABASE = "audio-ui-daw";
const HANDLES = "handles";
const FOLDER = "folder";

/** Whether this browser can open and save a folder the user picks. */
export function canUseFolders(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** A folder the user picks, or null when they close the picker. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (window as unknown as FolderAccess).showDirectoryPicker({
      id: "audio-ui-project",
      mode: "readwrite",
    });
  } catch (error) {
    if ((error as DOMException).name === "AbortError") {
      return null;
    }
    throw error;
  }
}

/** Whether the page may write to the folder, asking for it when it may not yet. */
export async function mayWrite(
  folder: FileSystemDirectoryHandle
): Promise<boolean> {
  const handle = folder as Permissions;
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") {
    return true;
  }
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

const readText = async (folder: FileSystemDirectoryHandle, name: string) =>
  (await (await folder.getFileHandle(name)).getFile()).text();

async function writeFile(
  folder: FileSystemDirectoryHandle,
  name: string,
  data: ArrayBuffer | string
) {
  const writable = await (
    await folder.getFileHandle(name, { create: true })
  ).createWritable();
  await writable.write(data);
  await writable.close();
}

/** Whether two files hold the same bytes. */
function sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  return left.every((byte, index) => byte === right[index]);
}

/** A file of `samples` already holding `bytes`, among those the recording `name` may be saved as. */
async function fileHolding(
  samples: FileSystemDirectoryHandle,
  taken: ReadonlySet<string>,
  name: string,
  extension: string,
  bytes: ArrayBuffer
): Promise<string | undefined> {
  // One after the other, and only until one holds them.
  return await savedAs(name, extension, [...taken]).reduce<
    Promise<string | undefined>
  >(async (earlier, file) => {
    const before = await earlier;
    if (before) {
      return before;
    }
    const found = await (await samples.getFileHandle(file)).getFile();
    return found.size === bytes.byteLength &&
      sameBytes(await found.arrayBuffer(), bytes)
      ? file
      : undefined;
  }, Promise.resolve(undefined));
}

/** The samples the folder's document already names, by recording id. */
async function savedSamples(
  folder: FileSystemDirectoryHandle,
  document: string
): Promise<Map<string, string>> {
  try {
    const file = readProjectFile(await readText(folder, document));
    return new Map(file.samples.map((sample) => [sample.id, sample.path]));
  } catch {
    return new Map();
  }
}

/**
 * Saves the project to its folder: `<folder>.audioui`, and in `Samples/` the
 * files of the recordings the folder lacks, read with `bytesOf`. A recording
 * whose bytes a file of its name already holds keeps that file, so saving
 * again writes no copy. Returns the names of the recordings whose files could
 * not be read.
 */
export async function saveToFolder(
  folder: FileSystemDirectoryHandle,
  doc: ArrangementDoc,
  recordings: readonly { id: string; name: string }[],
  bytesOf: (id: string) => Promise<ArrayBuffer | null>
): Promise<{ missing: string[] }> {
  const document = `${folder.name}${PROJECT_EXTENSION}`;
  const before = await savedSamples(folder, document);
  const samples = await folder.getDirectoryHandle(SAMPLES, { create: true });
  const taken = new Set(await Array.fromAsync(samples.keys()));
  const written: ProjectSample[] = [];
  const missing: string[] = [];
  await recordings.reduce(async (done, { id, name }) => {
    await done;
    const kept = before.get(id);
    if (kept && taken.has(kept.slice(SAMPLES.length + 1))) {
      written.push({ id, name, path: kept });
      return;
    }
    const bytes = await bytesOf(id);
    if (!bytes) {
      missing.push(name);
      return;
    }
    // Opened again, a recording has a new id: the file it was saved to is found by its bytes, not written twice.
    const extension = sniffExtension(bytes);
    const same = await fileHolding(samples, taken, name, extension, bytes);
    if (same) {
      written.push({ id, name, path: `${SAMPLES}/${same}` });
      return;
    }
    const file = sampleFileName(name, extension, taken);
    await writeFile(samples, file, bytes);
    taken.add(file);
    written.push({ id, name, path: `${SAMPLES}/${file}` });
  }, Promise.resolve());
  await writeFile(folder, document, writeProjectFile(doc, written));
  return { missing };
}

/** The folder's project document: `<folder>.audioui`, or else the first `.audioui` file in it. */
async function documentOf(folder: FileSystemDirectoryHandle): Promise<string> {
  const named = `${folder.name}${PROJECT_EXTENSION}`;
  const names = await Array.fromAsync(folder.keys());
  const found = names.includes(named)
    ? named
    : names.find((name) => name.endsWith(PROJECT_EXTENSION));
  if (!found) {
    throw new Error(`There is no ${PROJECT_EXTENSION} file in this folder.`);
  }
  return found;
}

/** A file of the folder, by its path in it, or null when it is not there. */
async function bytesAt(
  folder: FileSystemDirectoryHandle,
  path: string
): Promise<ArrayBuffer | null> {
  const parts = path.split("/");
  try {
    const parent = await parts
      .slice(0, -1)
      .reduce<Promise<FileSystemDirectoryHandle>>(
        async (at, name) => (await at).getDirectoryHandle(name),
        Promise.resolve(folder)
      );
    return await (
      await (await parent.getFileHandle(parts.at(-1) ?? "")).getFile()
    ).arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Reads a project folder: its document, and the bytes of each sample, one
 * after the other; the names of the samples that are not in the folder.
 */
export async function openFolder(folder: FileSystemDirectoryHandle): Promise<{
  bytes: Map<string, ArrayBuffer>;
  file: ProjectFile;
  missing: string[];
}> {
  const file = readProjectFile(
    await readText(folder, await documentOf(folder))
  );
  const bytes = new Map<string, ArrayBuffer>();
  const missing: string[] = [];
  await file.samples.reduce(async (done, sample) => {
    await done;
    const read = await bytesAt(folder, sample.path);
    if (read) {
      bytes.set(sample.id, read);
    } else {
      missing.push(sample.name);
    }
  }, Promise.resolve());
  return { bytes, file, missing };
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(HANDLES);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Keeps the folder the project belongs to, or forgets it with null, across reloads. */
export async function rememberFolder(
  folder: FileSystemDirectoryHandle | null
): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const store = db.transaction(HANDLES, "readwrite").objectStore(HANDLES);
    const request = folder ? store.put(folder, FOLDER) : store.delete(FOLDER);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

/** The folder the project belongs to, if one was remembered. */
export async function recallFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await database();
    const folder = await new Promise<FileSystemDirectoryHandle | null>(
      (resolve) => {
        const request = db
          .transaction(HANDLES, "readonly")
          .objectStore(HANDLES)
          .get(FOLDER);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => resolve(null);
      }
    );
    db.close();
    return folder;
  } catch {
    return null;
  }
}
