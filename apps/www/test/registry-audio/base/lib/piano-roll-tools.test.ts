import { describe, expect, test } from "bun:test";
import {
  clampNoteToDomain,
  createPianoRollTools,
  type PianoRollState,
} from "@/registry-audio/bases/base/lib/piano-roll-tools";

const roll = createPianoRollTools({
  maxPitch: 72,
  minPitch: 48,
  stepCount: 16,
});
const empty: PianoRollState = { bpm: 120, notes: [] };

describe("clampNoteToDomain (mirrors the primitive's normalization)", () => {
  test("clamps pitch, start, and length into the domain", () => {
    const note = clampNoteToDomain({ length: 0, pitch: 30, start: -5 }, "x", {
      maxPitch: 72,
      minLength: 1,
      minPitch: 48,
      stepCount: 16,
    });
    expect(note).toMatchObject({
      id: "x",
      length: 1,
      pitch: 48,
      start: 0,
      velocity: 1,
    });
  });
});

describe("setNotes", () => {
  test("replaces the roll and grid-snaps out-of-range notes", () => {
    const next = roll.setNotes.apply(empty, {
      notes: [
        { length: 2, pitch: 60, start: 0 },
        { length: 99, pitch: 100, start: 20 },
      ],
    });
    expect(next.notes).toHaveLength(2);
    expect(next.notes[0]).toMatchObject({
      id: 0,
      length: 2,
      pitch: 60,
      start: 0,
    });
    // pitch 100 -> 72, length 99 -> 16, start 20 -> (16 - 16) = 0
    expect(next.notes[1]).toMatchObject({
      length: 16,
      pitch: 72,
      start: 0,
    });
  });
});

describe("addNotes", () => {
  test("appends with a fresh, non-colliding id", () => {
    const seeded = roll.setNotes.apply(empty, {
      notes: [{ pitch: 60, start: 0 }],
    });
    const added = roll.addNotes.apply(seeded, {
      notes: [{ pitch: 64, start: 4 }],
    });
    expect(added.notes).toHaveLength(2);
    expect(added.notes[1]).toMatchObject({ id: 1, pitch: 64, start: 4 });
  });
});

describe("removeNotes", () => {
  test("drops notes by id", () => {
    const two = roll.setNotes.apply(empty, {
      notes: [
        { pitch: 60, start: 0 },
        { pitch: 62, start: 2 },
      ],
    });
    const removed = roll.removeNotes.apply(two, { ids: [0] });
    expect(removed.notes).toHaveLength(1);
    expect(removed.notes[0]?.id).toBe(1);
  });
});

describe("transpose", () => {
  test("shifts all notes and clamps at the range edge", () => {
    const seeded = roll.setNotes.apply(empty, {
      notes: [{ pitch: 60, start: 0 }],
    });
    expect(
      roll.transpose.apply(seeded, { semitones: 12 }).notes[0]?.pitch
    ).toBe(72);
    expect(
      roll.transpose.apply(seeded, { semitones: 24 }).notes[0]?.pitch
    ).toBe(72);
  });

  test("shifts only the given ids", () => {
    const two = roll.setNotes.apply(empty, {
      notes: [
        { pitch: 60, start: 0 },
        { pitch: 62, start: 2 },
      ],
    });
    const next = roll.transpose.apply(two, { ids: [0], semitones: 12 });
    expect(next.notes[0]?.pitch).toBe(72);
    expect(next.notes[1]?.pitch).toBe(62);
  });
});

describe("setTempo", () => {
  test("clamps into the BPM range", () => {
    expect(roll.setTempo.apply(empty, { bpm: 999 }).bpm).toBe(200);
    expect(roll.setTempo.apply(empty, { bpm: 5 }).bpm).toBe(20);
  });
});

describe("createPianoRollTools — the pitch range is parameterized", () => {
  test("a wide 88-key roll accepts a note the default range would clamp", () => {
    const wide = createPianoRollTools({
      maxPitch: 108,
      minPitch: 21,
      stepCount: 32,
    });
    const next = wide.setNotes.apply(
      { bpm: 120, notes: [] },
      { notes: [{ length: 2, pitch: 100, start: 30 }] }
    );
    expect(next.notes[0]?.pitch).toBe(100);
    expect(next.notes[0]?.start).toBe(30);
  });
});

describe("schemas reject malformed AI arguments", () => {
  test("a pitch out of the roll's range is rejected", () => {
    expect(
      roll.setNotes.schema.safeParse({ notes: [{ pitch: 200, start: 0 }] })
        .success
    ).toBe(false);
    expect(
      roll.setNotes.schema.safeParse({ notes: [{ pitch: 60, start: 0 }] })
        .success
    ).toBe(true);
  });

  test("a fractional semitone shift is rejected", () => {
    expect(roll.transpose.schema.safeParse({ semitones: 3 }).success).toBe(
      true
    );
    expect(roll.transpose.schema.safeParse({ semitones: 1.5 }).success).toBe(
      false
    );
  });
});
