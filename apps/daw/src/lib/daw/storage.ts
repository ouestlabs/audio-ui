/**
 * The project in the browser's private storage (PRJ-001, PRJ-002): its
 * document as JSON, and the bytes of each file it uses, as they were dropped,
 * so it plays again whatever became of the files. One project for now.
 */
import type { ArrangementDoc } from "@/lib/arrangement-state";

const PROJECT = "project.json";
const RECORDINGS = "recordings";

/** What is saved of a recording besides its bytes. */
export interface SavedRecording {
  id: string;
  name: string;
}

export interface SavedProject {
  doc: ArrangementDoc;
  recordings: SavedRecording[];
  /** The version of this shape, for a later one to read it. */
  version: 1;
}

/** Whether the browser keeps files for the page: the origin's private file system. */
export function canStore(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  );
}

async function write(
  folder: FileSystemDirectoryHandle,
  name: string,
  data: ArrayBuffer | string
) {
  const file = await folder.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function saveProject(project: SavedProject): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await write(root, PROJECT, JSON.stringify(project));
}

export async function loadProject(): Promise<SavedProject | null> {
  if (!canStore()) {
    return null;
  }
  try {
    const root = await navigator.storage.getDirectory();
    const file = await (await root.getFileHandle(PROJECT)).getFile();
    const project = JSON.parse(await file.text()) as SavedProject;
    return project.version === 1 ? project : null;
  } catch {
    return null;
  }
}

/** Keeps a recording's bytes, once: an id is never given to other bytes. */
export async function saveRecording(
  id: string,
  bytes: ArrayBuffer
): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const folder = await root.getDirectoryHandle(RECORDINGS, { create: true });
  await write(folder, id, bytes);
}

export async function loadRecording(id: string): Promise<ArrayBuffer | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle(RECORDINGS);
    return await (
      await (await folder.getFileHandle(id)).getFile()
    ).arrayBuffer();
  } catch {
    return null;
  }
}

/** Lets go of the recordings no clip plays any more. */
export async function pruneRecordings(
  kept: ReadonlySet<string>
): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle(RECORDINGS);
    for await (const name of folder.keys()) {
      if (!kept.has(name)) {
        await folder.removeEntry(name);
      }
    }
  } catch {
    // Nothing kept yet.
  }
}

/** Forgets the project: what a new one starts from. */
export async function clearProject(): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(PROJECT).catch(() => undefined);
  await root
    .removeEntry(RECORDINGS, { recursive: true })
    .catch(() => undefined);
}
