import { describe, expect, test } from "bun:test";
import {
  cellStart,
  changeVelocity,
  duplicateAfter,
  duplicateNotes,
  moveNotes,
  type Note,
  notesWithin,
  pasteNotes,
  quantizeNotes,
  resizeNotes,
  sameNotes,
  sanitizeNote,
  snapEdgeDelta,
  spatialOrder,
} from "./edits";

const BOUNDS = { duration: 16, maxPitch: 72, minLength: 1, minPitch: 48 };
const CHORD: Note[] = [
  { id: "c", length: 2, pitch: 60, start: 2 },
  { id: "e", length: 4, pitch: 64, start: 2 },
  { id: "x", length: 1, pitch: 70, start: 10 },
];
const BOTH = new Set(["c", "e"]);

describe("sanitizeNote", () => {
  test("keeps a note on the roll and at least minLength long", () => {
    expect(
      sanitizeNote({ id: 1, length: 0.2, pitch: 80.4, start: 15.5 }, BOUNDS)
    ).toEqual({ id: 1, length: 1, pitch: 72, start: 15, velocity: 1 });
    expect(
      sanitizeNote(
        { id: 1, length: Number.NaN, pitch: 10, start: -3, velocity: 4 },
        BOUNDS
      )
    ).toEqual({ id: 1, length: 1, pitch: 48, start: 0, velocity: 1 });
  });
});

describe("moveNotes", () => {
  test("moves a group by the same amount", () => {
    const moved = moveNotes(CHORD, BOTH, 3, 2, BOUNDS);
    expect(moved.map((note) => [note.start, note.pitch])).toEqual([
      [5, 62],
      [5, 66],
      [10, 70],
    ]);
  });

  test("stops the whole group where its most restricted note would leave", () => {
    const moved = moveNotes(CHORD, BOTH, 20, 20, BOUNDS);
    // e ends at 6 and reaches 72 first: the chord keeps its shape.
    expect(moved.map((note) => [note.start, note.pitch])).toEqual([
      [12, 68],
      [12, 72],
      [10, 70],
    ]);
  });
});

describe("resizeNotes", () => {
  test("lengthens the end of every note by the same amount, within the timeline", () => {
    const longer = resizeNotes(CHORD, BOTH, "end", 20, BOUNDS);
    expect(longer.map((note) => note.length)).toEqual([12, 14, 1]);
  });

  test("never makes a note shorter than minLength", () => {
    const shorter = resizeNotes(CHORD, BOTH, "end", -5, BOUNDS);
    expect(shorter.map((note) => note.length)).toEqual([1, 3, 1]);
  });

  test("trims from the front, keeping the end where it was", () => {
    const trimmed = resizeNotes(CHORD, BOTH, "start", 1, BOUNDS);
    expect(trimmed.slice(0, 2)).toMatchObject([
      { length: 1, start: 3 },
      { length: 3, start: 3 },
    ]);
    const extended = resizeNotes(CHORD, BOTH, "start", -5, BOUNDS);
    expect(extended[0]).toMatchObject({ length: 4, start: 0 });
  });
});

describe("snapEdgeDelta", () => {
  test("lands the dragged edge on the grid", () => {
    const note = { id: 1, length: 1.5, pitch: 60, start: 2 };
    expect(snapEdgeDelta(note, "end", 0.6, { offset: 0, step: 1 })).toBe(0.5);
    expect(snapEdgeDelta(note, "end", 0.8, { offset: 0, step: 0 })).toBeCloseTo(
      0.8
    );
  });
});

describe("duplicateNotes", () => {
  test("adds copies on top of the originals, mapping each original to its copy", () => {
    let next = 0;
    const { copyOf, notes } = duplicateNotes(CHORD, BOTH, () => {
      next += 1;
      return `copy-${next}`;
    });
    expect(notes).toHaveLength(5);
    expect(copyOf.get("e")).toBe("copy-2");
    expect(notes.at(-1)).toEqual({ ...CHORD[1], id: "copy-2" } as Note);
  });
});

describe("notesWithin", () => {
  test("finds the notes overlapping a stretch of time and a band of rows", () => {
    const rowOf = (pitch: number) => 72 - pitch;
    expect(
      notesWithin(CHORD, { end: 3, firstRow: 7, lastRow: 9, start: 2.5 }, rowOf)
    ).toEqual(["e"]);
    expect(
      notesWithin(CHORD, { end: 2, firstRow: 0, lastRow: 20, start: 0 }, rowOf)
    ).toEqual([]);
  });
});

describe("spatialOrder", () => {
  test("reads left to right, then top to bottom", () => {
    expect(spatialOrder([...CHORD].reverse()).map((note) => note.id)).toEqual([
      "e",
      "c",
      "x",
    ]);
  });
});

describe("sameNotes", () => {
  test("compares every field, in order", () => {
    expect(sameNotes(CHORD, [...CHORD])).toBe(true);
    expect(sameNotes(CHORD, [...CHORD].reverse())).toBe(false);
    expect(
      sameNotes(CHORD, [{ ...CHORD[0], start: 3 } as Note, ...CHORD.slice(1)])
    ).toBe(false);
  });
});

describe("cellStart", () => {
  test("is the grid line at or before the value", () => {
    expect(cellStart(3.9, { offset: 0, step: 1 })).toBe(3);
    expect(cellStart(3.9, { offset: 0.5, step: 2 })).toBe(2.5);
    expect(cellStart(3.9, { offset: 0, step: 0 })).toBe(3.9);
  });
});

describe("changeVelocity", () => {
  test("shifts each note by the same amount, within 0 to 1", () => {
    const notes: Note[] = [
      { id: "c", length: 1, pitch: 60, start: 0, velocity: 0.9 },
      { id: "e", length: 1, pitch: 64, start: 0, velocity: 0.5 },
      { id: "x", length: 1, pitch: 70, start: 0 },
    ];
    expect(
      changeVelocity(notes, BOTH, 0.2).map((note) => note.velocity)
    ).toEqual([1, 0.7, undefined]);
    expect(changeVelocity(notes, BOTH, -0.6)[1]?.velocity).toBe(0);
  });
});

describe("duplicateAfter", () => {
  const ids = () => {
    let next = 0;
    return () => {
      next += 1;
      return `copy-${next}`;
    };
  };

  test("places copies right after the selection, one length on", () => {
    const result = duplicateAfter(CHORD, BOTH, ids(), BOUNDS) as NonNullable<
      ReturnType<typeof duplicateAfter>
    >;
    expect(result.copies).toEqual(["copy-1", "copy-2"]);
    expect(result.notes.slice(3)).toEqual([
      { id: "copy-1", length: 2, pitch: 60, start: 6 },
      { id: "copy-2", length: 4, pitch: 64, start: 6 },
    ]);
  });

  test("stops where the roll ends, and does nothing without room", () => {
    expect(
      duplicateAfter(CHORD, new Set(["x"]), ids(), BOUNDS)?.notes[3]
    ).toMatchObject({
      start: 11,
    });
    const edge: Note[] = [{ id: "z", length: 2, pitch: 60, start: 14 }];
    expect(duplicateAfter(edge, new Set(["z"]), ids(), BOUNDS)).toBeNull();
    expect(duplicateAfter(CHORD, new Set(), ids(), BOUNDS)).toBeNull();
  });
});

describe("quantizeNotes", () => {
  const snap = (value: number) => Math.round(value / 4) * 4;

  test("snaps the starts of the notes in ids and leaves lengths and others alone", () => {
    const loose: Note[] = [
      { id: "a", length: 1.5, pitch: 60, start: 2.2 },
      { id: "b", length: 1, pitch: 61, start: 5.7 },
    ];
    expect(quantizeNotes(loose, new Set(["a"]), snap, BOUNDS)).toEqual([
      { id: "a", length: 1.5, pitch: 60, start: 4 },
      loose[1] as Note,
    ]);
  });

  test("keeps a snapped note inside the roll", () => {
    const edge: Note[] = [{ id: "a", length: 6, pitch: 60, start: 11.2 }];
    expect(quantizeNotes(edge, new Set(["a"]), snap, BOUNDS)[0]).toMatchObject({
      start: 10,
    });
  });
});

describe("pasteNotes", () => {
  const counter = () => {
    let next = 0;
    return () => {
      next += 1;
      return `p${next}`;
    };
  };

  test("puts the earliest note at the position and keeps the spacing", () => {
    const result = pasteNotes([], CHORD, 4, counter(), BOUNDS) as NonNullable<
      ReturnType<typeof pasteNotes>
    >;
    expect(result.notes.map((note) => note.start)).toEqual([4, 4, 12]);
    expect(result.pasted).toEqual(["p1", "p2", "p3"]);
  });

  test("stops where the roll ends, and does nothing for an empty clipboard", () => {
    const result = pasteNotes([], CHORD, 15, counter(), BOUNDS) as NonNullable<
      ReturnType<typeof pasteNotes>
    >;
    expect(result.notes.map((note) => note.start)).toEqual([7, 7, 15]);
    expect(pasteNotes([], [], 0, counter(), BOUNDS)).toBeNull();
  });
});
