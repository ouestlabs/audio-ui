import { describe, expect, test } from "bun:test";
import {
  clampNoteToDomain,
  createPianoRollTools,
  type PianoRollState,
} from "@/registry-audio/bases/base/lib/piano-roll-tools";

const roll = createPianoRollTools({
  endNote: 72,
  startNote: 48,
  stepCount: 16,
});
const empty: PianoRollState = { bpm: 120, notes: [] };

describe("clampNoteToDomain (mirrors the primitive's normalization)", () => {
  test("clamps note, startStep, and duration into the domain", () => {
    const note = clampNoteToDomain(
      { duration: 0, note: 30, startStep: -5 },
      "x",
      { endNote: 72, minDuration: 1, startNote: 48, stepCount: 16 }
    );
    expect(note).toMatchObject({
      duration: 1,
      id: "x",
      note: 48,
      startStep: 0,
      velocity: 1,
    });
  });
});

describe("setNotes", () => {
  test("replaces the roll and grid-snaps out-of-range notes", () => {
    const next = roll.setNotes.apply(empty, {
      notes: [
        { duration: 2, note: 60, startStep: 0 },
        { duration: 99, note: 100, startStep: 20 },
      ],
    });
    expect(next.notes).toHaveLength(2);
    expect(next.notes[0]).toMatchObject({
      duration: 2,
      id: 0,
      note: 60,
      startStep: 0,
    });
    // note 100 -> 72, duration 99 -> 16, startStep 20 -> (16 - 16) = 0
    expect(next.notes[1]).toMatchObject({
      duration: 16,
      note: 72,
      startStep: 0,
    });
  });
});

describe("addNotes", () => {
  test("appends with a fresh, non-colliding id", () => {
    const seeded = roll.setNotes.apply(empty, {
      notes: [{ note: 60, startStep: 0 }],
    });
    const added = roll.addNotes.apply(seeded, {
      notes: [{ note: 64, startStep: 4 }],
    });
    expect(added.notes).toHaveLength(2);
    expect(added.notes[1]).toMatchObject({ id: 1, note: 64, startStep: 4 });
  });
});

describe("removeNotes", () => {
  test("drops notes by id", () => {
    const two = roll.setNotes.apply(empty, {
      notes: [
        { note: 60, startStep: 0 },
        { note: 62, startStep: 2 },
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
      notes: [{ note: 60, startStep: 0 }],
    });
    expect(roll.transpose.apply(seeded, { semitones: 12 }).notes[0]?.note).toBe(
      72
    );
    expect(roll.transpose.apply(seeded, { semitones: 24 }).notes[0]?.note).toBe(
      72
    );
  });

  test("shifts only the given ids", () => {
    const two = roll.setNotes.apply(empty, {
      notes: [
        { note: 60, startStep: 0 },
        { note: 62, startStep: 2 },
      ],
    });
    const next = roll.transpose.apply(two, { ids: [0], semitones: 12 });
    expect(next.notes[0]?.note).toBe(72);
    expect(next.notes[1]?.note).toBe(62);
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
      endNote: 108,
      startNote: 21,
      stepCount: 32,
    });
    const next = wide.setNotes.apply(
      { bpm: 120, notes: [] },
      { notes: [{ duration: 2, note: 100, startStep: 30 }] }
    );
    expect(next.notes[0]?.note).toBe(100);
    expect(next.notes[0]?.startStep).toBe(30);
  });
});

describe("schemas reject malformed AI arguments", () => {
  test("note out of the roll's range is rejected", () => {
    expect(
      roll.setNotes.schema.safeParse({ notes: [{ note: 200, startStep: 0 }] })
        .success
    ).toBe(false);
    expect(
      roll.setNotes.schema.safeParse({ notes: [{ note: 60, startStep: 0 }] })
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
