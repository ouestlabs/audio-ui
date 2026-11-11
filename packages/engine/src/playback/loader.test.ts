import { describe, expect, test } from "bun:test";
import { createRecordingLoader, type RecordingFile } from "./loader.ts";
import type { RecordingLoaderReply } from "./protocol.ts";
import { createPagePool, createRecordingStream } from "./stream.ts";

const PAGE = 256;

/** A recording's file as the loader reads it: its channels one after the other. */
function fileOf(channels: readonly Float32Array[]): RecordingFile {
  const bytes = new Float32Array(
    channels.reduce((sum, c) => sum + c.length, 0)
  );
  let at = 0;
  for (const channel of channels) {
    bytes.set(channel, at);
    at += channel.length;
  }
  return {
    close: () => undefined,
    read: (buffer, { at: byte }) => {
      const from = byte / Float32Array.BYTES_PER_ELEMENT;
      const part = bytes.subarray(from, from + buffer.length);
      buffer.set(part);
      return part.length * Float32Array.BYTES_PER_ELEMENT;
    },
  };
}

function setup(frames: number) {
  const channels = [0, 1].map((channel) =>
    Float32Array.from({ length: frames }, (_, index) => index + channel * 0.5)
  );
  const pool = createPagePool(8, { pageFrames: PAGE, shared: false });
  const stream = createRecordingStream(pool, 2, frames);
  const replies: RecordingLoaderReply[] = [];
  const opened: string[] = [];
  const loader = createRecordingLoader({
    open: async (path) => {
      opened.push(path.join("/"));
      // A file opens later than the message that asks for it is posted.
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (path.at(-1) === "missing") {
        throw new Error("not found");
      }
      return fileOf(channels);
    },
    reply: (message) => replies.push(message),
  });
  return { channels, loader, opened, pool, replies, stream };
}

describe("the loader of streamed recordings", () => {
  test("G-013: it reads each channel's pages from the file, a page at the end only as far as the recording goes", async () => {
    const { channels, loader, pool, replies, stream } = setup(PAGE + 100);
    loader({ id: "take", path: ["cache", "take"], stream, type: "add" });
    await loader({
      id: 1,
      requests: [
        { page: 1, recording: "take" },
        { page: 0, recording: "take" },
      ],
      type: "want",
    });
    expect(replies).toEqual([{ id: 1, loaded: 2, type: "loaded" }]);
    const slot = stream.directory[1] as number;
    const right = pool.samples.subarray(
      (slot * 2 + 1) * PAGE,
      (slot * 2 + 2) * PAGE
    );
    expect(right.subarray(0, 100)).toEqual(
      (channels[1] as Float32Array).subarray(PAGE)
    );
    expect(right.subarray(100).every((sample) => sample === 0)).toBe(true);
  });

  test("G-013: a request waits for the file it needs to open, as it came after it", async () => {
    const { loader, replies, stream } = setup(PAGE);
    loader({ id: "take", path: ["take"], stream, type: "add" });
    await loader({
      id: 2,
      requests: [{ page: 0, recording: "take" }],
      type: "want",
    });
    expect(replies.at(-1)).toEqual({ id: 2, loaded: 1, type: "loaded" });
  });

  test("G-013: a file that cannot be opened is said so, and its pages stay out", async () => {
    const { loader, replies, stream } = setup(PAGE);
    loader({ id: "gone", path: ["missing"], stream, type: "add" });
    await loader({
      id: 3,
      requests: [{ page: 0, recording: "gone" }],
      type: "want",
    });
    expect(replies[0]).toMatchObject({ id: "gone", type: "failed" });
    expect(replies[1]).toEqual({ id: 3, loaded: 0, type: "loaded" });
    expect(stream.directory[0]).toBe(-1);
  });

  test("G-013: a recording let go is not read again", async () => {
    const { loader, replies, stream } = setup(2 * PAGE);
    loader({ id: "take", path: ["take"], stream, type: "add" });
    loader({ id: "take", type: "forget" });
    await loader({
      id: 4,
      requests: [{ page: 0, recording: "take" }],
      type: "want",
    });
    expect(replies.at(-1)).toEqual({ id: 4, loaded: 0, type: "loaded" });
  });
});
