/**
 * Recordings read from pages instead of whole arrays, for sets too long to
 * decode into memory. Every streamed recording of a context shares one pool
 * of pages, each `pageFrames` frames of every channel; a recording's
 * directory says which slot of the pool holds each of its pages, or -1. A
 * loader fills slots ahead of playback (`PageCache`) and the player reads
 * them (`streamedSample`); both can sit on either side of a worker or a
 * worklet, since the pool and the directories may live in shared memory.
 */

/** How many frames a page holds: about 0.7 s at 48 kHz. */
export const PAGE_FRAMES = 32_768;

/** The slots every streamed recording of a context reads from. */
export interface PagePool {
  /** Channels per slot: a mono recording fills the first. */
  readonly channels: number;
  readonly pageFrames: number;
  /** Every slot, one after the other, each its channels one after the other. */
  readonly samples: Float32Array;
  readonly slots: number;
}

/** A recording as the player reads it from the pool. */
export interface RecordingStream {
  readonly channels: number;
  /** The slot of the pool that holds each of its pages, or -1 while none does. */
  readonly directory: Int32Array;
  /** How many frames it lasts. */
  readonly length: number;
  readonly pool: PagePool;
}

/** One page of one recording. */
export interface PageRequest {
  page: number;
  recording: string;
}

/** Memory for `bytes`: shared when the page can share it, so a worker and a worklet see the same. */
function memory(bytes: number, shared: boolean): ArrayBufferLike {
  return shared ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);
}

/** A pool of `slots` pages, in shared memory unless `shared` is false. */
export function createPagePool(
  slots: number,
  {
    channels = 2,
    pageFrames = PAGE_FRAMES,
    shared = true,
  }: { channels?: number; pageFrames?: number; shared?: boolean } = {}
): PagePool {
  const length = slots * channels * pageFrames;
  return {
    channels,
    pageFrames,
    samples: new Float32Array(
      memory(length * Float32Array.BYTES_PER_ELEMENT, shared)
    ),
    slots,
  };
}

/** Where a slot's channel starts in the pool's samples. */
export function slotOffset(
  pool: PagePool,
  slot: number,
  channel: number
): number {
  return (slot * pool.channels + channel) * pool.pageFrames;
}

/** A recording of `length` frames read from `pool`, none of its pages there yet. */
export function createRecordingStream(
  pool: PagePool,
  channels: number,
  length: number,
  shared = pool.samples.buffer instanceof SharedArrayBuffer
): RecordingStream {
  const pages = Math.max(1, Math.ceil(length / pool.pageFrames));
  const directory = new Int32Array(
    memory(pages * Int32Array.BYTES_PER_ELEMENT, shared)
  );
  directory.fill(-1);
  return {
    channels: Math.min(channels, pool.channels),
    directory,
    length,
    pool,
  };
}

/** A channel's sample at a frame: silence outside the recording, and while its page is not there. */
export function streamedSample(
  stream: RecordingStream,
  channel: number,
  index: number
): number {
  if (!(index >= 0 && index < stream.length)) {
    return 0;
  }
  const { pool } = stream;
  const page = Math.floor(index / pool.pageFrames);
  const slot = stream.directory[page] ?? -1;
  if (slot < 0) {
    return 0;
  }
  return (
    pool.samples[
      slotOffset(pool, slot, channel) + index - page * pool.pageFrames
    ] ?? 0
  );
}

/**
 * Reads a page of a recording into its slot: one array per channel of the
 * recording, `pageFrames` long, to fill from the page's first frame. A page
 * at the end is shorter: what is left of the arrays stays silent.
 */
export type PageReader = (
  recording: string,
  page: number,
  channels: readonly Float32Array[]
) => void;

/**
 * Keeps the pages that are asked for in the pool: it loads those missing, in
 * the order they come, into free slots or into the slots asked for longest
 * ago, and never into a slot asked for in the same call. A slot leaves its
 * directory before it is written, and joins the new one once it is full, so
 * the player reads a whole page or silence, never half of one.
 */
export class PageCache {
  private readonly holder: ({ page: number; recording: string } | null)[];
  private readonly lastAsked: number[];
  private readonly pool: PagePool;
  private readonly read: PageReader;
  private readonly streams = new Map<string, RecordingStream>();
  private tick = 0;

  constructor(pool: PagePool, read: PageReader) {
    this.pool = pool;
    this.read = read;
    this.holder = Array.from({ length: pool.slots }, () => null);
    this.lastAsked = Array.from({ length: pool.slots }, () => -1);
  }

  /** A recording it can load pages of, under the id requests name it by. */
  add(recording: string, stream: RecordingStream): void {
    this.streams.set(recording, stream);
  }

  /** Lets a recording go: its slots are free again. */
  forget(recording: string): void {
    this.streams.delete(recording);
    for (const [slot, held] of this.holder.entries()) {
      if (held?.recording === recording) {
        this.holder[slot] = null;
        this.lastAsked[slot] = -1;
      }
    }
  }

  /** Loads the pages asked for that are missing, soonest first; returns how many it loaded. */
  want(requests: readonly PageRequest[]): number {
    this.tick += 1;
    const asked = this.tick;
    let loaded = 0;
    for (const { page, recording } of requests) {
      const stream = this.streams.get(recording);
      if (!stream || page < 0 || page >= stream.directory.length) {
        continue;
      }
      const held = Atomics.load(stream.directory, page);
      if (held >= 0) {
        this.lastAsked[held] = asked;
        continue;
      }
      const slot = this.freeSlot(asked);
      if (slot === -1) {
        // Every slot holds a page asked for now: the rest wait for the next call.
        break;
      }
      this.load(slot, recording, stream, page);
      this.lastAsked[slot] = asked;
      loaded += 1;
    }
    return loaded;
  }

  /** An empty slot, or the one asked for longest ago; -1 when all were asked for in this call. */
  private freeSlot(asked: number): number {
    let oldest = -1;
    for (let slot = 0; slot < this.pool.slots; slot += 1) {
      if (this.holder[slot] === null) {
        return slot;
      }
      const last = this.lastAsked[slot] ?? -1;
      if (
        last < asked &&
        (oldest === -1 || last < (this.lastAsked[oldest] ?? -1))
      ) {
        oldest = slot;
      }
    }
    return oldest;
  }

  private load(
    slot: number,
    recording: string,
    stream: RecordingStream,
    page: number
  ) {
    const before = this.holder[slot];
    if (before) {
      const previous = this.streams.get(before.recording);
      if (previous) {
        Atomics.store(previous.directory, before.page, -1);
      }
    }
    const { pageFrames, samples } = this.pool;
    const channels = Array.from({ length: stream.channels }, (_, channel) => {
      const start = slotOffset(this.pool, slot, channel);
      const view = samples.subarray(start, start + pageFrames);
      view.fill(0);
      return view;
    });
    this.read(recording, page, channels);
    this.holder[slot] = { page, recording };
    Atomics.store(stream.directory, page, slot);
  }
}
