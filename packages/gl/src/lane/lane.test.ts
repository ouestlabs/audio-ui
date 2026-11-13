import { describe, expect, test } from "bun:test";
import {
  CHUNK_FRAMES,
  type ChunkFeed,
  clearLane,
  feedChunks,
  type LaneClip,
  type LaneSegment,
  type SampleCache,
  sameSamples,
  visibleClips,
  visibleClipsNow,
} from "./index.ts";

const RATE = 1000;
const memory = new Float32Array(10_000);

/** A clip that plays its recording on from `offset` seconds. */
const clip = (
  id: string,
  start: number,
  length: number,
  offset = 0,
  source = "a"
): LaneClip => ({
  gain: 1,
  id,
  length,
  sampleRate: RATE,
  samples: { frames: memory.length, read: () => memory.subarray(0) },
  segments: (from, to) => [
    { frames: [(offset + from) * RATE, (offset + to) * RATE], from, to },
  ],
  source,
  start,
});

describe("sameSamples", () => {
  test("a new view of the same memory is the same samples", () => {
    expect(sameSamples(memory.subarray(0), memory.subarray(0))).toBe(true);
    expect(sameSamples(memory.subarray(0, 5), memory.subarray(0))).toBe(false);
    expect(sameSamples(memory.subarray(1), memory.subarray(0))).toBe(false);
    expect(sameSamples(undefined, memory)).toBe(false);
    expect(sameSamples(new Float32Array(10_000), memory)).toBe(false);
  });

  test("arrays that are not typed are the same only when they are the same array", () => {
    const array = [1, 2, 3];
    expect(sameSamples(array, array)).toBe(true);
    expect(sameSamples([1, 2, 3], array)).toBe(false);
  });
});

describe("visibleClips", () => {
  test("a clip on screen has its part at its x, and the frames it reads there", async () => {
    // 100 px a second: the clip starts at 2 s (200 px) and reads from 1 s of its recording.
    const [one] = await visibleClips(
      [clip("c", 2, 3, 1)],
      { from: 0, to: 1000 },
      100
    );
    expect(one?.parts).toEqual([{ frames: [1000, 4000], width: 300, x: 200 }]);
  });

  test("the canvas cuts it: only what shows, with the frames of that stretch", async () => {
    const [one] = await visibleClips(
      [clip("c", 0, 10)],
      { from: 300, to: 500 },
      100
    );
    expect(one?.parts).toEqual([{ frames: [3000, 5000], width: 200, x: 0 }]);
  });

  test("clips off the canvas are left out", async () => {
    const found = await visibleClips(
      [clip("early", 0, 1), clip("late", 50, 1), clip("here", 5, 1)],
      { from: 400, to: 700 },
      100
    );
    expect(found.map((each) => each.entry.id)).toEqual(["here"]);
  });

  test("a clip of several stretches is drawn in parts, each at its own place", async () => {
    // A loop of 1 s read three times: each turn reads frames 0 to 1000.
    const turns: LaneSegment[] = [0, 1, 2].map((turn) => ({
      frames: [0, 1000],
      from: turn,
      to: turn + 1,
    }));
    const looped: LaneClip = { ...clip("loop", 0, 3), segments: () => turns };
    const [one] = await visibleClips([looped], { from: 0, to: 1000 }, 100);
    expect(one?.parts.map((part) => part.x)).toEqual([0, 100, 200]);
    expect(
      one?.parts.every(
        (part) => part.frames[0] === 0 && part.frames[1] === 1000
      )
    ).toBe(true);
  });

  test("a stretch read backwards is not drawn, the ones read on are", async () => {
    const mixed: LaneClip = {
      ...clip("rev", 0, 2),
      segments: () => [
        { frames: [1000, 0], from: 0, to: 1 },
        { frames: [0, 1000], from: 1, to: 2 },
      ],
    };
    const [one] = await visibleClips([mixed], { from: 0, to: 1000 }, 100);
    expect(one?.parts).toEqual([{ frames: [0, 1000], width: 100, x: 100 }]);
  });

  test("the canvas cutting a stretch cuts its frames the same share", async () => {
    const stretched: LaneClip = {
      ...clip("warp", 0, 10),
      segments: () => [{ frames: [0, 4000], from: 0, to: 10 }],
    };
    const [one] = await visibleClips([stretched], { from: 500, to: 700 }, 100);
    expect(one?.parts).toEqual([{ frames: [2000, 2800], width: 200, x: 0 }]);
  });

  test("a recording is read once, however many clips read it", async () => {
    let reads = 0;
    const counting = (id: string, start: number): LaneClip => ({
      ...clip(id, start, 1),
      samples: {
        frames: memory.length,
        read: () => {
          reads += 1;
          return memory;
        },
      },
    });
    await visibleClips(
      [counting("a", 0), counting("b", 1), counting("c", 2)],
      { from: 0, to: 1000 },
      100
    );
    expect(reads).toBe(1);
  });
});

describe("visibleClipsNow", () => {
  test("gives what visibleClips gives when every recording is at hand", async () => {
    const clips = [clip("a", 0, 2), clip("b", 3, 2, 1, "other")];
    const placed = { from: 0, to: 1000 };
    const now = visibleClipsNow(clips, placed, 100);
    const later = await visibleClips(clips, placed, 100);
    expect(now?.map((each) => each.parts)).toEqual(
      later.map((each) => each.parts)
    );
    expect(sameSamples(now?.[0]?.data, later[0]?.data ?? [])).toBe(true);
  });

  test("is null when a recording reads its samples later, so the lane waits for them", () => {
    const streamed: LaneClip = {
      ...clip("s", 0, 2, 0, "streamed"),
      samples: { frames: memory.length, read: () => Promise.resolve(memory) },
    };
    expect(
      visibleClipsNow([clip("a", 3, 1), streamed], { from: 0, to: 1000 }, 100)
    ).toBeNull();
  });

  test("a clip off the view is not read at all", () => {
    let reads = 0;
    const counted: LaneClip = {
      ...clip("far", 100, 1),
      samples: {
        frames: memory.length,
        read: () => {
          reads += 1;
          return memory;
        },
      },
    };
    expect(visibleClipsNow([counted], { from: 0, to: 1000 }, 100)).toEqual([]);
    expect(reads).toBe(0);
  });
});

describe("the sample cache", () => {
  const counting = () => {
    let reads = 0;
    const samples = {
      frames: memory.length,
      read: () => {
        reads += 1;
        // A reader that copies the whole recording each time, as one that mixes channels does.
        return new Float32Array(memory);
      },
    };
    return { count: () => reads, samples };
  };

  test("a recording is read once across paints, and the same samples come back", () => {
    const { count, samples } = counting();
    const cache: SampleCache = new Map();
    const one: LaneClip = { ...clip("a", 0, 2), samples };
    const first = visibleClipsNow([one], { from: 0, to: 1000 }, 100, cache);
    const second = visibleClipsNow([one], { from: 0, to: 1000 }, 50, cache);
    expect(count()).toBe(1);
    expect(second?.[0]?.data).toBe(first?.[0]?.data as Float32Array);
  });

  test("another reader for the recording is read again", () => {
    const cache: SampleCache = new Map();
    const a = counting();
    const b = counting();
    visibleClipsNow(
      [{ ...clip("a", 0, 2), samples: a.samples }],
      { from: 0, to: 1000 },
      100,
      cache
    );
    visibleClipsNow(
      [{ ...clip("a", 0, 2), samples: b.samples }],
      { from: 0, to: 1000 },
      100,
      cache
    );
    expect([a.count(), b.count()]).toEqual([1, 1]);
  });

  test("a recording read later is kept once read, so the next paint has it at once", async () => {
    const cache: SampleCache = new Map();
    const later: LaneClip = {
      ...clip("s", 0, 2, 0, "streamed"),
      samples: { frames: memory.length, read: () => Promise.resolve(memory) },
    };
    expect(
      visibleClipsNow([later], { from: 0, to: 1000 }, 100, cache)
    ).toBeNull();
    await visibleClips([later], { from: 0, to: 1000 }, 100, cache);
    expect(
      visibleClipsNow([later], { from: 0, to: 1000 }, 100, cache)?.[0]?.data
    ).toBe(memory);
  });
});

describe("clearLane", () => {
  test("turns the scissor test off before it clears, so the whole canvas is cleared", () => {
    const calls: string[] = [];
    const gl = {
      COLOR_BUFFER_BIT: 0x40_00,
      SCISSOR_TEST: 0x0c_11,
      clear: () => calls.push("clear"),
      clearColor: () => calls.push("clearColor"),
      disable: (what: number) =>
        calls.push(what === 0x0c_11 ? "disable scissor" : "disable"),
    } as unknown as WebGL2RenderingContext;
    clearLane(gl);
    expect(calls).toEqual(["disable scissor", "clearColor", "clear"]);
  });

  test("does nothing without a context", () => {
    expect(() => clearLane(null)).not.toThrow();
  });
});

describe("feedChunks", () => {
  const frames = CHUNK_FRAMES * 100 + 10;
  const setup = () => {
    const asked: [number, number][] = [];
    const set: number[] = [];
    const dropped: number[] = [];
    const samples = {
      frames,
      read: (from: number, to: number) => {
        asked.push([from, to]);
        return Promise.resolve(new Float32Array(to - from));
      },
    };
    const renderer = {
      drop: (from: number) => dropped.push(from / CHUNK_FRAMES),
      set: (_: ArrayLike<number>, offset: number) =>
        set.push(offset / CHUNK_FRAMES),
    };
    const feed: ChunkFeed = { held: [], reading: new Set() };
    return { asked, dropped, feed, renderer, samples, set };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  test("reads the chunks a range covers, hands each over once read, and says when to draw again", async () => {
    const { asked, feed, renderer, samples, set } = setup();
    let ready = 0;
    const whole = feedChunks(
      feed,
      samples,
      [[CHUNK_FRAMES * 2 + 5, CHUNK_FRAMES * 4 - 1]],
      renderer,
      () => {
        ready += 1;
      },
      () => true
    );
    expect(whole).toBe(false);
    expect(asked).toEqual([
      [CHUNK_FRAMES * 2, CHUNK_FRAMES * 3],
      [CHUNK_FRAMES * 3, CHUNK_FRAMES * 4],
    ]);
    await settle();
    expect(set).toEqual([2, 3]);
    expect(ready).toBe(2);
    expect(
      feedChunks(
        feed,
        samples,
        [[CHUNK_FRAMES * 2, CHUNK_FRAMES * 4]],
        renderer,
        () => undefined,
        () => true
      )
    ).toBe(true);
    expect(asked).toHaveLength(2);
  });

  test("a chunk being read is not read again, and the last one stops at the recording's end", () => {
    const { asked, feed, renderer, samples } = setup();
    const range = [[CHUNK_FRAMES * 100, frames + 500]] as const;
    feedChunks(
      feed,
      samples,
      range,
      renderer,
      () => undefined,
      () => true
    );
    feedChunks(
      feed,
      samples,
      range,
      renderer,
      () => undefined,
      () => true
    );
    expect(asked).toEqual([[CHUNK_FRAMES * 100, frames]]);
  });

  test("a renderer let go of in the meantime is handed nothing", async () => {
    const { feed, renderer, samples, set } = setup();
    feedChunks(
      feed,
      samples,
      [[0, 10]],
      renderer,
      () => undefined,
      () => false
    );
    await settle();
    expect(set).toEqual([]);
    expect(feed.held).toEqual([]);
  });

  test("past the most it keeps, the oldest chunks the view no longer reads are let go of", async () => {
    const { dropped, feed, renderer, samples } = setup();
    const at = (chunk: number) =>
      [[chunk * CHUNK_FRAMES, (chunk + 1) * CHUNK_FRAMES]] as const;
    const feedOne = (chunk: number) =>
      feedChunks(
        feed,
        samples,
        at(chunk),
        renderer,
        () => undefined,
        () => true
      );
    // One chunk after another, each read before the next is asked for.
    await Array.from({ length: 71 }).reduce<Promise<unknown>>(
      async (before, _, chunk) => {
        await before;
        feedOne(chunk);
        await settle();
      },
      Promise.resolve()
    );
    expect(feed.held).toHaveLength(64);
    expect(dropped).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(feed.held.at(-1)).toBe(70);
  });
});
