import { describe, expect, test } from "bun:test";
import {
  type LaneClip,
  type LaneSegment,
  sameSamples,
  visibleClips,
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
