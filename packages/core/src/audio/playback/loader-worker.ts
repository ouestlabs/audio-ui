/**
 * The loader of streamed recordings as it runs in a Worker: `createRecordingLoader`
 * over the origin private file system. It is not imported by the package:
 * `bun run worklet:build` bundles it into `RECORDING_LOADER_WORKER`, the
 * source a page starts the worker from.
 */
import { createRecordingLoader, type RecordingFile } from "./loader.ts";
import type {
  RecordingLoaderMessage,
  RecordingLoaderReply,
} from "./protocol.ts";

/** The file handle a worker can open for synchronous access, which the DOM library leaves out. */
interface SyncFileHandle extends FileSystemFileHandle {
  createSyncAccessHandle: () => Promise<RecordingFile>;
}

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<RecordingLoaderMessage>) => void) | null;
  postMessage: (message: RecordingLoaderReply) => void;
};

const handle = createRecordingLoader({
  open: async (path) => {
    const folder = await path
      .slice(0, -1)
      .reduce<Promise<FileSystemDirectoryHandle>>(
        async (parent, name) => (await parent).getDirectoryHandle(name),
        navigator.storage.getDirectory()
      );
    const file = (await folder.getFileHandle(
      path.at(-1) ?? ""
    )) as SyncFileHandle;
    return file.createSyncAccessHandle();
  },
  reply: (message) => scope.postMessage(message),
});

scope.onmessage = (event) => {
  handle(event.data);
};
