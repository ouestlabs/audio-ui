import { describe, expect, test } from "bun:test";
import { type ArrangedAudio, playedClip } from "./clip.ts";
import { pagesAhead } from "./plan.ts";
import {
  type DecodedRecording,
  type Recording,
  renderClips,
} from "./render.ts";
import {
  createPagePool,
  createRecordingStream,
  PageCache,
  type PageReader,
  type RecordingStream,
} from "./stream.ts";
import type { PlaybackState } from "./transport.ts";

const RATE = 48_000;
/** Small pages, so a second of audio spans many of them. */
const PAGE = 1024;

/** A recording whose every sample differs, so a frame read from the wrong page shows. */
function decoded(frames: number, channels = 2): DecodedRecording {
  return {
    channels: Array.from({ length: channels }, (_entry, channel) =>
      Float32Array.from(
        { length: frames },
        (_, index) => 0.5 * Math.sin(index * (0.013 + index * 1e-7) + channel)
      )
    ),
    sampleRate: RATE,
  };
}

/** Reads pages out of a decoded recording, and keeps a list of what it read. */
function readerOf(source: DecodedRecording, log: string[] = []): PageReader {
  return (recording, page, channels) => {
    log.push(`${recording}:${page}`);
    for (const [channel, view] of channels.entries()) {
      const data = source.channels[channel] as Float32Array;
      view.set(data.subarray(page * PAGE, page * PAGE + PAGE));
    }
  };
}

/** The decoded recording as a stream, every page loaded. */
function streamed(source: DecodedRecording, slots = 256) {
  const pool = createPagePool(slots, { pageFrames: PAGE, shared: false });
  const { length } = source.channels[0] as Float32Array;
  const stream = createRecordingStream(pool, source.channels.length, length);
  const cache = new PageCache(pool, readerOf(source));
  cache.add("take", stream);
  return { cache, pool, stream };
}

function loadAll(cache: PageCache, stream: RecordingStream) {
  cache.want(
    Array.from({ length: stream.directory.length }, (_, page) => ({
      page,
      recording: "take",
    }))
  );
}

function audio(
  start: number,
  length: number,
  rest: Partial<ArrangedAudio> = {}
): ArrangedAudio {
  return {
    sourceLength: length,
    ...rest,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start },
  };
}

/** What `clip` plays over `frames` frames from the arrangement's frame 0, from `recording`. */
function render(clip: ArrangedAudio, recording: Recording, frames: number) {
  const output: [Float32Array, Float32Array] = [
    new Float32Array(frames),
    new Float32Array(frames),
  ];
  renderClips(
    output,
    0,
    frames,
    0,
    [playedClip(clip, "take", RATE)],
    new Map([["take", recording]]),
    RATE
  );
  return output;
}

const playing = (position: number, at = 0): PlaybackState => ({
  at,
  loop: null,
  playing: true,
  position,
});

describe("streamed recordings", () => {
  test("G-013: with its pages in the pool, a streamed recording plays the frames the decoded one does", () => {
    const source = decoded(RATE);
    const { cache, stream } = streamed(source);
    loadAll(cache, stream);
    const clips = [
      audio(0, 0.5),
      audio(0.1, 0.5, { loop: [0.1, 0.2] }),
      audio(0, 0.5, { reversed: true }),
      audio(0, 0.5, {
        warp: [
          { source: 0, target: 0 },
          { source: 0.5, target: 0.4 },
        ],
      }),
    ];
    for (const clip of clips) {
      const expected = render(clip, source, RATE / 2);
      const actual = render(clip, { sampleRate: RATE, stream }, RATE / 2);
      expect(actual).toEqual(expected);
    }
  });

  test("G-013: a page not in the pool plays silence, and plays once it is loaded", () => {
    const source = decoded(4 * PAGE);
    const { cache, stream } = streamed(source);
    cache.want([{ page: 1, recording: "take" }]);
    const clip = audio(0, (4 * PAGE) / RATE);
    const [left] = render(clip, { sampleRate: RATE, stream }, 4 * PAGE);
    const data = source.channels[0] as Float32Array;
    expect(left.subarray(0, PAGE).every((sample) => sample === 0)).toBe(true);
    expect(left.subarray(PAGE, 2 * PAGE)).toEqual(
      data.subarray(PAGE, 2 * PAGE)
    );
    expect(left.subarray(2 * PAGE).every((sample) => sample === 0)).toBe(true);
  });

  test("G-013: a mono stream plays in both channels", () => {
    const source = decoded(2 * PAGE, 1);
    const { cache, stream } = streamed(source);
    loadAll(cache, stream);
    const [left, right] = render(
      audio(0, (2 * PAGE) / RATE),
      { sampleRate: RATE, stream },
      2 * PAGE
    );
    expect(right).toEqual(left);
    expect(left).toEqual(source.channels[0] as Float32Array);
  });
});

describe("PageCache", () => {
  test("it loads what is missing, once, in the order asked", () => {
    const log: string[] = [];
    const source = decoded(8 * PAGE);
    const pool = createPagePool(4, { pageFrames: PAGE, shared: false });
    const stream = createRecordingStream(pool, 2, 8 * PAGE);
    const cache = new PageCache(pool, readerOf(source, log));
    cache.add("take", stream);
    const ask = (pages: number[]) =>
      cache.want(pages.map((page) => ({ page, recording: "take" })));
    expect(ask([2, 0, 2])).toBe(2);
    expect(ask([0, 2])).toBe(0);
    expect(log).toEqual(["take:2", "take:0"]);
  });

  test("a full pool gives up the page asked for longest ago, never one asked for in the same call", () => {
    const source = decoded(8 * PAGE);
    const pool = createPagePool(3, { pageFrames: PAGE, shared: false });
    const stream = createRecordingStream(pool, 2, 8 * PAGE);
    const cache = new PageCache(pool, readerOf(source));
    cache.add("take", stream);
    const ask = (pages: number[]) =>
      cache.want(pages.map((page) => ({ page, recording: "take" })));
    ask([0, 1, 2]);
    ask([1, 2]);
    ask([5]);
    // Page 0 was asked for longest ago: its slot holds page 5 now.
    expect([...stream.directory].map((slot) => slot >= 0)).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
    // Four pages asked for at once in three slots: the fourth waits.
    expect(ask([3, 4, 6, 7])).toBe(3);
    expect(stream.directory[7]).toBe(-1);
  });

  test("a recording let go frees its slots", () => {
    const source = decoded(2 * PAGE);
    const pool = createPagePool(2, { pageFrames: PAGE, shared: false });
    const first = createRecordingStream(pool, 2, 2 * PAGE);
    const second = createRecordingStream(pool, 2, 2 * PAGE);
    const cache = new PageCache(pool, readerOf(source));
    cache.add("a", first);
    cache.add("b", second);
    cache.want([
      { page: 0, recording: "a" },
      { page: 1, recording: "a" },
    ]);
    cache.forget("a");
    expect(
      cache.want([
        { page: 0, recording: "b" },
        { page: 1, recording: "b" },
      ])
    ).toBe(2);
  });

  test("the pool and the directories can be shared with a worker and a worklet", () => {
    const pool = createPagePool(2, { pageFrames: PAGE });
    const stream = createRecordingStream(pool, 2, PAGE);
    expect(pool.samples.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(stream.directory.buffer).toBeInstanceOf(SharedArrayBuffer);
  });
});

describe("pagesAhead", () => {
  const recordings = () => ({ length: 64 * PAGE, sampleRate: RATE });
  const plan = (
    clip: ArrangedAudio,
    state: PlaybackState,
    frame: number,
    count: number
  ) =>
    pagesAhead(
      state,
      [playedClip(clip, "take", RATE)],
      frame,
      count,
      recordings,
      RATE,
      PAGE
    ).map((request) => request.page);

  test("G-013: a clip played from its start needs its pages in order, and the neighbours of the frames it ends on", () => {
    const clip = audio(0, (64 * PAGE) / RATE);
    expect(plan(clip, playing(0), 0, 4 * PAGE)).toEqual([0, 1, 2, 3, 4]);
  });

  test("G-013: from a later frame of the arrangement, and while stopped from where a play would start", () => {
    const clip = audio(0, (64 * PAGE) / RATE);
    expect(plan(clip, playing(10 * PAGE), 0, 2 * PAGE)).toEqual([
      9, 10, 11, 12,
    ]);
    const stopped = { ...playing(10 * PAGE), playing: false };
    expect(plan(clip, stopped, 0, 2 * PAGE)).toEqual([9, 10, 11, 12]);
  });

  test("G-013: a loop of the transport brings back the pages at its start", () => {
    const clip = audio(0, (64 * PAGE) / RATE);
    const looped = { ...playing(3 * PAGE), loop: [0, 4 * PAGE] as const };
    expect(plan(clip, looped, 0, 2 * PAGE)).toEqual([2, 3, 4, 0, 1]);
  });

  test("G-013: a reversed clip reads its recording from the end", () => {
    const clip = audio(0, (8 * PAGE) / RATE, { reversed: true });
    expect(plan(clip, playing(0), 0, PAGE)[0]).toBe(7);
  });

  test("G-013: a clip that starts between two steps still has its first page", () => {
    const clip = audio((PAGE + 5) / RATE, (8 * PAGE) / RATE, {
      sourceFrom: (20 * PAGE) / RATE,
      sourceLength: (8 * PAGE) / RATE,
    });
    expect(plan(clip, playing(0), 0, 2 * PAGE)[0]).toBe(19);
  });

  test("G-013: a recording that is not there, or a stretch with no clip, needs nothing", () => {
    const clip = audio(10, 1);
    expect(plan(clip, playing(0), 0, PAGE)).toEqual([]);
    expect(
      pagesAhead(
        playing(0),
        [playedClip(audio(0, 1), "elsewhere", RATE)],
        0,
        PAGE,
        () => undefined,
        RATE,
        PAGE
      )
    ).toEqual([]);
  });
});
