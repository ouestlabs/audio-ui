/**
 * Runs an operation of the Process menu off the page (`processSource`). A
 * recording held in memory is sent, processed, measured and encoded as a WAV
 * file of floats, all posted back. A streamed one is processed from its cache
 * file into a cache of its own beside it (its samples, peaks, leaves and
 * entry), which the page then streams; its WAV file, what the project keeps it
 * by, is written after, a block at a time, while the page goes on.
 *
 * An edit of a stretch of a streamed recording reads that stretch alone: the
 * samples on either side are copied from the file as they are, and their
 * leaves taken from the recording's, so a cut in an hour-long take costs what
 * the cut does. An operation on all of it reads it through. It encodes with
 * the engine's `encodeAudio` itself: a worker is never in the server's build,
 * which `audio-files` keeps the encoders out of.
 */
import { encodeAudio } from "@audio-ui/engine/files";
import { LEAF_FRAMES } from "@audio-ui/gl/waveform";
import type { StreamedSource } from "@/lib/clip-player";
import {
  CACHE,
  type CacheEntry,
  cacheNames,
  RECORDINGS,
  writeFile,
} from "@/lib/daw/files";
import {
  leavesPeaks,
  type Measured,
  measurePeaks,
  measureSound,
} from "@/lib/daw/measure";
import {
  cacheFile,
  folderOf,
  leavesName,
  makeLeaves,
  readChannels,
  setsOf,
  transferable,
} from "@/lib/daw/samples";
import {
  applySoundOperation,
  SEAM,
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

/** A job sent to the worker, and the ticket its answers come back with: one worker runs every job, side by side. */
export interface ProcessRequest {
  job: ProcessJob;
  ticket: number;
}

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

/** An answer to the job of `ticket`. */
export interface ProcessAnswer {
  done: ProcessDone;
  ticket: number;
}

/** How a job answers: to its own ticket. */
type Post = (done: ProcessDone, transfer?: Transferable[]) => void;

const BYTES = Float32Array.BYTES_PER_ELEMENT;
/** The frames read before an edited stretch to settle the band filters, so the leaves made of it join those before it. */
const SETTLE = 16 * LEAF_FRAMES;
/** The frames of a WAV file written at a time. */
const WAV_BLOCK = 1 << 18;

/** The frames of `range`, in seconds, as `applySoundOperation` reads them: rounded, in order, inside a sound of `frames`. */
const framesOf = (
  range: SoundRange,
  sampleRate: number,
  frames: number
): [number, number] =>
  range
    .map((time) => Math.max(0, Math.min(frames, Math.round(time * sampleRate))))
    .sort((a, b) => a - b) as [number, number];

async function inMemory(
  { channels: read, operation, range, sampleRate }: MemoryJob,
  post: Post
) {
  const { channels } = applySoundOperation(
    { channels: read, sampleRate },
    operation,
    range ?? undefined
  );
  const bytes = await (
    await encodeAudio(channels, { bitDepth: 32, format: "wav", sampleRate })
  ).arrayBuffer();
  const measured = measureSound(channels, sampleRate);
  post({ bytes, channels, kind: "memory", measured }, [
    bytes,
    ...transferable(channels),
    measured.peaks.max.buffer as ArrayBuffer,
    measured.peaks.min.buffer as ArrayBuffer,
  ]);
}

/**
 * The WAV file of floats `encodeAudio` makes, written into `recordings/<id>`
 * from the cache just made, a block of frames at a time: the sound is never
 * held whole.
 */
async function writeWav(
  id: string,
  { channels, length, sampleRate }: CacheEntry
) {
  const samples = await (
    await (await navigator.storage.getDirectory()).getDirectoryHandle(CACHE)
  )
    .getFileHandle(cacheNames(id).samples)
    .then((handle) => handle.getFile());
  const size = length * channels * BYTES;
  const header = new DataView(new ArrayBuffer(44));
  header.setUint32(0, 0x52_49_46_46); // "RIFF"
  header.setUint32(4, 36 + size, true);
  header.setUint32(8, 0x57_41_56_45); // "WAVE"
  header.setUint32(12, 0x66_6d_74_20); // "fmt "
  header.setUint32(16, 16, true);
  header.setUint16(20, 3, true); // floats
  header.setUint16(22, channels, true);
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * channels * BYTES, true);
  header.setUint16(32, channels * BYTES, true);
  header.setUint16(34, 32, true);
  header.setUint32(36, 0x64_61_74_61); // "data"
  header.setUint32(40, size, true);
  const block = async (from: number) => {
    const to = Math.min(length, from + WAV_BLOCK);
    const read = await Promise.all(
      Array.from(
        { length: channels },
        async (_, channel) =>
          new Float32Array(
            await samples
              .slice(
                (channel * length + from) * BYTES,
                (channel * length + to) * BYTES
              )
              .arrayBuffer()
          )
      )
    );
    const frames = new Float32Array((to - from) * channels);
    for (const [channel, part] of read.entries()) {
      for (let frame = 0; frame < part.length; frame += 1) {
        frames[frame * channels + channel] = part[frame] ?? 0;
      }
    }
    return frames;
  };
  await writeFile(RECORDINGS, id, [
    header,
    ...Array.from(
      { length: Math.ceil(length / WAV_BLOCK) },
      (_, index) => () => block(index * WAV_BLOCK)
    ),
  ]);
}

/** The cache of `id` written, its entry last: with its entry there, the cache is whole and the page reads it. */
async function writeCache(
  id: string,
  entry: CacheEntry,
  samples: Parameters<typeof writeFile>[2],
  peaks: { max: Float32Array; min: Float32Array },
  leaves: Float32Array,
  post: Post
) {
  const names = cacheNames(id);
  await Promise.all([
    writeFile(CACHE, names.samples, samples),
    writeFile(CACHE, names.range, [
      peaks.max as Float32Array<ArrayBuffer>,
      peaks.min as Float32Array<ArrayBuffer>,
    ]),
    writeFile(CACHE, names.leaves, [leaves as Float32Array<ArrayBuffer>]),
  ]);
  await writeFile(CACHE, names.entry, [JSON.stringify(entry)]);
  post({ entry, kind: "made" });
  await writeWav(id, entry);
  post({ kind: "saved" });
}

/** A streamed recording's leaves as they are kept beside its cache file, or null where there are none to splice. */
async function storedLeaves(source: StreamedSource) {
  const stored = await (await folderOf(source.path))
    .getFileHandle(leavesName(source.path.at(-1) ?? ""))
    .then((handle) => handle.getFile())
    .catch(() => null);
  const size =
    Math.ceil(source.length / LEAF_FRAMES) * 4 * setsOf(source.channels);
  return stored && stored.size === size * BYTES
    ? new Float32Array(await stored.arrayBuffer())
    : null;
}

/**
 * An operation on `range` of a streamed recording, made of that stretch alone:
 * whole leaves on either side of it, past its seams, are what the operation
 * reads around it. The samples before and after are slices of the cache file,
 * copied as they are; their leaves are the recording's, to the nearest leaf
 * where what follows moved by less than one. False where the recording keeps
 * no leaves to splice.
 */
async function splice(
  { id, operation, source, window: [start, end] }: StreamedJob,
  range: SoundRange,
  post: Post
): Promise<boolean> {
  const old = await storedLeaves(source);
  if (!old) {
    return false;
  }
  const { channels: count, length: total, sampleRate } = source;
  const frames = end - start;
  const [from, to] = framesOf(range, sampleRate, frames);
  const fade = Math.round(SEAM * sampleRate);
  const around = (Math.ceil((fade + 1) / LEAF_FRAMES) + 1) * LEAF_FRAMES;
  const first = Math.max(
    0,
    Math.floor((from - around) / LEAF_FRAMES) * LEAF_FRAMES
  );
  const last = Math.min(frames, to + around);
  const settle = Math.min(first, SETTLE);
  const read = await readChannels(
    source,
    start + first - settle,
    start + Math.min(frames, last + LEAF_FRAMES)
  );
  const { channels: made } = applySoundOperation(
    {
      channels: read.map((channel) =>
        channel.subarray(settle, settle + last - first)
      ),
      sampleRate,
    },
    operation,
    [(from - first) / sampleRate, (to - first) / sampleRate]
  );
  const madeLength = made[0]?.length ?? 0;
  const length = frames - (last - first) + madeLength;
  // The leaves are made again up to a whole leaf past what was made, with the frames that follow it, or to the end.
  const madeEnd = Math.min(
    length,
    Math.ceil((first + madeLength) / LEAF_FRAMES) * LEAF_FRAMES
  );
  const extra = madeEnd - first - madeLength;
  const joined = read.map((channel, index) => {
    const out = new Float32Array(settle + madeLength + extra);
    out.set(channel.subarray(0, settle));
    out.set(made[index] ?? new Float32Array(madeLength), settle);
    const after = settle + last - first;
    out.set(channel.subarray(after, after + extra), settle + madeLength);
    return out;
  });
  const joinedLength = settle + madeLength + extra;
  const fresh = await makeLeaves(count, joinedLength, sampleRate, (a, b) =>
    joined.map((channel) => channel.subarray(a, b))
  );
  const sets = setsOf(count);
  const oldSize = Math.ceil(total / LEAF_FRAMES) * 4;
  const freshSize = Math.ceil(joinedLength / LEAF_FRAMES) * 4;
  const size = Math.ceil(length / LEAF_FRAMES) * 4;
  const leaves = new Float32Array(size * sets);
  const kept = (first / LEAF_FRAMES) * 4;
  const remade = Math.ceil((madeEnd - first) / LEAF_FRAMES) * 4;
  const skip = (settle / LEAF_FRAMES) * 4;
  const before = Math.round(start / LEAF_FRAMES) * 4;
  const after = Math.round((start + last + extra) / LEAF_FRAMES) * 4;
  for (let set = 0; set < sets; set += 1) {
    const was = set * oldSize;
    const into = set * size;
    leaves.set(old.subarray(was + before, was + before + kept), into);
    leaves.set(
      fresh.subarray(set * freshSize + skip, set * freshSize + skip + remade),
      into + kept
    );
    const rest = old.subarray(
      was + after,
      Math.min(was + oldSize, was + after + size - kept - remade)
    );
    leaves.set(rest, into + kept + remade);
    // A leaf the recording's ran out before holds no frame.
    for (
      let at = into + kept + remade + rest.length;
      at < into + size;
      at += 4
    ) {
      leaves.set(
        [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, 0],
        at
      );
    }
  }
  const file = await cacheFile(source);
  const at = (channel: number, frame: number) =>
    (channel * total + frame) * BYTES;
  await writeCache(
    id,
    { channels: count, length, sampleRate },
    made.flatMap((part, channel) => [
      file.slice(at(channel, start), at(channel, start + first)),
      part as Float32Array<ArrayBuffer>,
      file.slice(at(channel, start + last), at(channel, end)),
    ]),
    leavesPeaks(leaves, count, length, sampleRate),
    leaves,
    post
  );
  return true;
}

async function streamed(job: StreamedJob, post: Post) {
  const { id, operation, range, source, window } = job;
  if (range && operation.type !== "crop" && (await splice(job, range, post))) {
    return;
  }
  const { sampleRate } = source;
  // Crop keeps its stretch alone: that is all there is to read.
  const kept =
    range && operation.type === "crop"
      ? framesOf(range, sampleRate, window[1] - window[0])
      : null;
  const channels = kept
    ? await readChannels(source, window[0] + kept[0], window[0] + kept[1])
    : applySoundOperation(
        {
          channels: await readChannels(source, window[0], window[1]),
          sampleRate,
        },
        operation,
        range ?? undefined
      ).channels;
  const length = channels[0]?.length ?? 0;
  const leaves = await makeLeaves(
    channels.length,
    length,
    sampleRate,
    (from, to) => channels.map((channel) => channel.subarray(from, to))
  );
  await writeCache(
    id,
    { channels: channels.length, length, sampleRate },
    channels as Float32Array<ArrayBuffer>[],
    measurePeaks(channels, sampleRate),
    leaves,
    post
  );
}

self.onmessage = async ({ data }: MessageEvent<ProcessRequest>) => {
  const { job, ticket } = data;
  const post: Post = (done, transfer = []) =>
    self.postMessage({ done, ticket } satisfies ProcessAnswer, { transfer });
  try {
    await (job.kind === "memory" ? inMemory(job, post) : streamed(job, post));
  } catch (error) {
    post({ kind: "failed", message: (error as Error).message });
  }
};
