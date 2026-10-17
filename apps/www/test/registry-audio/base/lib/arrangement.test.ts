import { describe, expect, test } from "bun:test";
import {
  type Arranged,
  automationAt,
  clipReach,
  flatAutomation,
  mixAt,
  panPosition,
  playedNotes,
  volumeGain,
  volumeValue,
} from "@/registry-audio/bases/base/lib/arrangement";

function clip(
  id: string,
  track: string,
  start: number,
  length: number
): Arranged {
  return {
    id,
    name: id,
    sourceLength: 100,
    track,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start },
  };
}

describe("clipReach", () => {
  const warp = [
    { source: 0, target: 0 },
    { source: 4, target: 8 },
  ];

  test("is the length of the source for a clip that plays it once", () => {
    const once = { ...clip("a", "drums", 0, 10), sourceLength: 24 };
    expect(clipReach(once)).toBe(24);
  });

  test("has no end for a clip that loops, warped or not", () => {
    const looped = {
      ...clip("a", "drums", 0, 10),
      loop: [0, 4] as const,
      sourceLength: 4,
    };
    expect(clipReach(looped)).toBeUndefined();
    expect(clipReach({ ...looped, warp })).toBeUndefined();
  });

  test("is as far as its warp stretches the source for a warped clip", () => {
    // Played at half speed: four seconds of source last eight on the clip.
    const warped = { ...clip("a", "drums", 0, 10), sourceLength: 4, warp };
    expect(clipReach(warped)).toBe(8);
  });
});

describe("playedNotes", () => {
  const midi = (overrides: Partial<Arranged> = {}): Arranged => ({
    id: "m",
    name: "Bass",
    notes: [
      { id: "a", length: 1, pitch: 40, start: 0 },
      { id: "b", length: 3, pitch: 43, start: 2 },
    ],
    sourceLength: 4,
    track: "bass",
    value: { fadeIn: 0, fadeOut: 0, length: 4, offset: 0, start: 10 },
    ...overrides,
  });

  test("places the notes where the clip plays them, cut at its end", () => {
    const notes = playedNotes(
      midi({
        value: { fadeIn: 0, fadeOut: 0, length: 3, offset: 0, start: 10 },
      })
    );
    expect(notes.map((note) => [note.start, note.length, note.pitch])).toEqual([
      [10, 1, 40],
      [12, 1, 43],
    ]);
  });

  test("starts from the clip's offset, and transposes with it", () => {
    const notes = playedNotes(
      midi({
        transpose: 12,
        value: { fadeIn: 0, fadeOut: 0, length: 3, offset: 1, start: 10 },
      })
    );
    expect(notes.map((note) => [note.start, note.pitch])).toEqual([[11, 55]]);
  });

  test("plays its loop again and again, each time a note of its own", () => {
    const notes = playedNotes(
      midi({
        loop: [0, 4],
        value: { fadeIn: 0, fadeOut: 0, length: 12, offset: 0, start: 0 },
      })
    );
    expect(notes.map((note) => note.start)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(new Set(notes.map((note) => note.id)).size).toBe(6);
    expect(notes.map((note) => note.sourceId)).toEqual([
      "a",
      "b",
      "a",
      "b",
      "a",
      "b",
    ]);
  });
});

describe("automation", () => {
  test("reads an envelope along its segments and their curves", () => {
    const points = [
      { x: 0, y: 0 },
      { curve: 0.5, x: 0.5, y: 1 },
      { x: 1, y: 0 },
    ];
    expect(automationAt(points, 0.25)).toBeCloseTo(0.5, 5);
    expect(automationAt(points, 0.5)).toBe(1);
    // A positive curve holds the start of its segment.
    expect(automationAt(points, 0.75)).toBeGreaterThan(0.5);
    expect(automationAt(points, -1)).toBe(0);
    expect(automationAt(points, 2)).toBe(0);
    expect(automationAt(flatAutomation(0.3), 0.6)).toBe(0.3);
  });

  test("maps volume to a gain and back, and pan to the stereo field", () => {
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(volumeValue(1))).toBeCloseTo(1, 6);
    expect(volumeGain(1)).toBeCloseTo(10 ** (6 / 20), 6);
    expect(volumeValue(0)).toBe(0);
    expect(panPosition(0.5)).toBe(0);
    expect(panPosition(0)).toBe(-1);
  });

  test("a track plays its envelopes, and its mix where it has none or is overridden", () => {
    const mix = { color: 0, gain: 0.5, muted: false, pan: 0.25, soloed: false };
    const track = {
      automation: { volume: flatAutomation(0) },
      color: 0,
      id: "keys",
      name: "Keys",
    };
    expect(mixAt(track, mix, 0.5)).toEqual({ gain: 0, pan: 0.25 });
    expect(mixAt(track, mix, 0.5, ["volume"])).toEqual({
      gain: 0.5,
      pan: 0.25,
    });
  });
});
