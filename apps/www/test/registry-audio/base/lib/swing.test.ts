import { describe, expect, test } from "bun:test";
import {
  type Arranged,
  playedNotes,
  swungTime,
} from "@/registry-audio/bases/base/lib/arrangement";

describe("swungTime", () => {
  test("leaves the even steps where they are and pushes the odd ones late, a third of a step at the most", () => {
    expect(swungTime(0, 0.25, 1)).toBe(0);
    expect(swungTime(0.5, 0.25, 1)).toBe(0.5);
    expect(swungTime(0.25, 0.25, 1)).toBeCloseTo(0.25 + 0.25 / 3, 9);
    expect(swungTime(0.25, 0.25, 0.5)).toBeCloseTo(0.25 + 0.25 / 6, 9);
  });

  test("straight at no amount, and never reorders two times", () => {
    expect(swungTime(0.3, 0.25, 0)).toBe(0.3);
    let last = -1;
    for (let time = 0; time < 2; time += 0.01) {
      const swung = swungTime(time, 0.25, 1);
      expect(swung).toBeGreaterThan(last);
      last = swung;
    }
  });
});

describe("a swung clip", () => {
  const beat = 0.5;
  const clip: Arranged = {
    id: "hats",
    loop: [0, 2],
    name: "Hats",
    notes: [0, 1, 2, 3].map((index) => ({
      id: index,
      length: 0.1,
      pitch: 42,
      start: index * 0.125,
      velocity: 1,
    })),
    sourceLength: 2,
    swing: { amount: 1, division: 16 },
    track: "drums",
    value: { fadeIn: 0, fadeOut: 0, length: 2, offset: 0, start: 4 },
  };

  test("plays its off-beat sixteenths late, given the beat", () => {
    const starts = playedNotes(clip, beat).map((note) => note.start - 4);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeCloseTo(0.125 + 0.125 / 3, 9);
    expect(starts[2]).toBeCloseTo(0.25, 9);
  });

  test("is drawn as written: without the beat, nothing moves", () => {
    expect(playedNotes(clip).map((note) => note.start - 4)).toEqual([
      0, 0.125, 0.25, 0.375,
    ]);
  });

  test("swings on the eighths when its division says so", () => {
    const eighths = { ...clip, swing: { amount: 1, division: 8 as const } };
    const starts = playedNotes(eighths, beat).map((note) => note.start - 4);
    expect(starts[2]).toBeCloseTo(0.25 + 0.25 / 3, 9);
    expect(starts[0]).toBe(0);
  });
});
