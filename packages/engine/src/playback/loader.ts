import type {
  RecordingLoaderMessage,
  RecordingLoaderReply,
} from "./protocol.ts";
import { PageCache } from "./stream.ts";

/** What the loader reads a recording's file through: a synchronous access handle of the origin private file system. */
export interface RecordingFile {
  close: () => void;
  read: (buffer: Float32Array, options: { at: number }) => number;
}

/**
 * The loader of streamed recordings, with no worker around it: it opens each
 * recording's file with `open`, loads the pages asked for into the pool its
 * streams share, and answers through `reply`. Messages are handled one after
 * the other, in the order they came, so a request never runs ahead of the
 * file it needs.
 */
export function createRecordingLoader({
  open,
  reply,
}: {
  open: (path: readonly string[]) => Promise<RecordingFile>;
  reply: (message: RecordingLoaderReply) => void;
}): (message: RecordingLoaderMessage) => Promise<void> {
  const files = new Map<string, { file: RecordingFile; length: number }>();
  let cache: PageCache | null = null;
  let queue: Promise<void> = Promise.resolve();

  const readPage = (
    id: string,
    page: number,
    channels: readonly Float32Array[]
  ) => {
    const held = files.get(id);
    const [first] = channels;
    if (!(held && first)) {
      return;
    }
    const start = page * first.length;
    const frames = Math.min(first.length, held.length - start);
    for (const [channel, view] of channels.entries()) {
      held.file.read(view.subarray(0, frames), {
        at: (channel * held.length + start) * Float32Array.BYTES_PER_ELEMENT,
      });
    }
  };

  const receive = async (message: RecordingLoaderMessage) => {
    if (message.type === "add") {
      try {
        const file = await open(message.path);
        files.set(message.id, { file, length: message.stream.length });
        cache ??= new PageCache(message.stream.pool, readPage);
        cache.add(message.id, message.stream);
      } catch (error) {
        reply({ id: message.id, message: String(error), type: "failed" });
      }
    } else if (message.type === "forget") {
      cache?.forget(message.id);
      files.get(message.id)?.file.close();
      files.delete(message.id);
    } else {
      reply({
        id: message.id,
        loaded: cache ? cache.want(message.requests) : 0,
        type: "loaded",
      });
    }
  };

  return (message) => {
    queue = queue.then(() => receive(message));
    return queue;
  };
}
