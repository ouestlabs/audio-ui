import { describe, expect, test } from "bun:test";
import {
  cellStart,
  changeLevel,
  changeVelocity,
  chopNotes,
  deleteTime,
  duplicateAfter,
  duplicateNotes,
  duplicateTime,
  findNotes,
  fitNotesToScale,
  humanizeNotes,
  insertTime,
  invertNotes,
  joinNotes,
  legatoNotes,
  moveNotes,
  type Note,
  notesWithin,
  pasteNotes,
  quantizeNotes,
  rampVelocity,
  resizeNotes,
  reverseNotes,
  sameNotes,
  sanitizeNote,
  selectionSpan,
  setChance,
  setDeviation,
  snapEdgeDelta,
  spatialOrder,
  splitNotes,
  stretchNotes,
  toggleMuted,
} from "./edits.ts";

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

const counter = () => {
  let id = 100;
  return () => {
    id += 1;
    return id;
  };
};
const PHRASE: Note[] = [
  { id: 1, length: 2, pitch: 60, start: 0, velocity: 0.5 },
  { id: 2, length: 1, pitch: 64, start: 4 },
  { id: 3, length: 2, pitch: 67, start: 6 },
];
const ALL = new Set([1, 2, 3]);

describe("splitNotes", () => {
  test("cuts the notes that hold the time, and leaves the rest", () => {
    const { added, notes } = splitNotes(PHRASE, ALL, 1, counter());
    expect(added).toEqual([101]);
    expect(notes).toEqual([
      { id: 1, length: 1, pitch: 60, start: 0, velocity: 0.5 },
      { id: 101, length: 1, pitch: 60, start: 1, velocity: 0.5 },
      PHRASE[1] as Note,
      PHRASE[2] as Note,
    ]);
  });

  test("does not cut at a note's edge", () => {
    expect(splitNotes(PHRASE, ALL, 4, counter()).added).toEqual([]);
  });

  test("chops to the grid at every time it is given", () => {
    const grid = Array.from({ length: 16 }, (_, step) => step);
    const { added, notes } = splitNotes(PHRASE, ALL, grid, counter());
    expect(added).toHaveLength(2);
    expect(notes.every((note) => note.length === 1)).toBe(true);
  });
});

describe("chopNotes", () => {
  test("cuts each note in equal parts, as many as fit at the shortest length", () => {
    const { added, notes } = chopNotes(PHRASE, ALL, 4, counter(), 0.5);
    expect(added).toHaveLength(7);
    const first = notes.filter((note) => note.pitch === 60);
    expect(first.map((note) => [note.start, note.length])).toEqual([
      [0, 0.5],
      [0.5, 0.5],
      [1, 0.5],
      [1.5, 0.5],
    ]);
    expect(notes.filter((note) => note.pitch === 64)).toHaveLength(2);
  });
});

describe("joinNotes", () => {
  test("joins notes of one pitch from the first start to the last end", () => {
    const notes: Note[] = [
      { id: 1, length: 1, pitch: 60, start: 0, velocity: 0.5 },
      { id: 2, length: 1, pitch: 60, start: 3 },
      { id: 3, length: 1, pitch: 62, start: 1 },
    ];
    expect(joinNotes(notes, new Set([1, 2, 3]))).toEqual([
      { id: 1, length: 4, pitch: 60, start: 0, velocity: 0.5 },
      notes[2] as Note,
    ]);
  });
});

describe("legatoNotes", () => {
  test("each note reaches the next start, the last keeps its length", () => {
    expect(legatoNotes(PHRASE, ALL, 0.25).map((note) => note.length)).toEqual([
      4, 2, 2,
    ]);
  });

  test("the last notes reach the end, when there is one", () => {
    expect(
      legatoNotes(PHRASE, ALL, 0.25, 16).map((note) => note.length)
    ).toEqual([4, 2, 10]);
  });

  test("the notes of a chord all reach the next one", () => {
    const chord: Note[] = [
      { id: 1, length: 1, pitch: 60, start: 0 },
      { id: 2, length: 3, pitch: 64, start: 0 },
      { id: 3, length: 1, pitch: 60, start: 2 },
    ];
    expect(legatoNotes(chord, ALL, 0.25).map((note) => note.length)).toEqual([
      2, 2, 1,
    ]);
  });
});

describe("reverseNotes", () => {
  test("mirrors the notes across their span", () => {
    expect(reverseNotes(PHRASE, ALL).map((note) => note.start)).toEqual([
      6, 3, 0,
    ]);
  });
});

describe("invertNotes", () => {
  test("turns the range upside down", () => {
    expect(invertNotes(PHRASE, ALL).map((note) => note.pitch)).toEqual([
      67, 63, 60,
    ]);
  });
});

describe("stretchNotes", () => {
  test("doubles from the earliest start, as far as the roll goes", () => {
    const doubled = stretchNotes(PHRASE, new Set([2, 3]), 2, BOUNDS);
    expect(doubled.slice(1).map((note) => [note.start, note.length])).toEqual([
      [4, 2],
      [8, 4],
    ]);
    const capped = stretchNotes(PHRASE, ALL, 4, BOUNDS);
    expect(Math.max(...capped.map((note) => note.start + note.length))).toBe(
      16
    );
  });

  test("halves, and keeps every note at least the shortest length", () => {
    const halved = stretchNotes(PHRASE, ALL, 0.5, BOUNDS);
    expect(halved.map((note) => [note.start, note.length])).toEqual([
      [0, 1],
      [2, 1],
      [3, 1],
    ]);
  });
});

describe("fitNotesToScale", () => {
  test("moves the notes out of the scale to the nearest pitch in it", () => {
    const notes: Note[] = [
      { id: 1, length: 1, pitch: 61, start: 0 },
      { id: 2, length: 1, pitch: 64, start: 1 },
    ];
    expect(
      fitNotesToScale(
        notes,
        new Set([1, 2]),
        { name: "major", root: 0 },
        BOUNDS
      ).map((note) => note.pitch)
    ).toEqual([60, 64]);
  });
});

describe("rampVelocity", () => {
  test("sets the velocity along a line through the starts", () => {
    expect(
      rampVelocity(PHRASE, ALL, 0.2, 0.8).map((note) =>
        Number(note.velocity?.toFixed(6))
      )
    ).toEqual([0.2, 0.6, 0.8]);
  });
});

describe("humanizeNotes", () => {
  test("moves starts and velocities by up to the amounts, on the roll", () => {
    const high = humanizeNotes(
      PHRASE,
      ALL,
      { timing: 0.5, velocity: 0.2 },
      BOUNDS,
      () => 1
    );
    expect(high.map((note) => note.start)).toEqual([0.5, 4.5, 6.5]);
    expect(high.map((note) => note.velocity)).toEqual([0.7, 1, 1]);
    const low = humanizeNotes(
      PHRASE,
      ALL,
      { timing: 0.5, velocity: 0.2 },
      BOUNDS,
      () => 0
    );
    expect(low[0]?.start).toBe(0);
  });
});

describe("toggleMuted", () => {
  test("deactivates the notes, and activates them once they all are", () => {
    const some = toggleMuted(PHRASE, new Set([1]));
    expect(some.map((note) => note.muted)).toEqual([
      true,
      undefined,
      undefined,
    ]);
    const mixed = toggleMuted(some, new Set([1, 2]));
    expect(mixed.map((note) => note.muted)).toEqual([true, true, undefined]);
    const back = toggleMuted(mixed, new Set([1, 2]));
    expect(back.map((note) => note.muted)).toEqual([false, false, undefined]);
  });
});

describe("setChance", () => {
  test("sets the chance, kept within 0…1", () => {
    expect(
      setChance(PHRASE, new Set([2, 3]), 1.5).map((note) => note.chance)
    ).toEqual([undefined, 1, 1]);
    expect(setChance(PHRASE, ALL, 0.25)[0]?.chance).toBe(0.25);
  });
});

describe("selectionSpan", () => {
  test("spans from the earliest start to the latest end", () => {
    expect(selectionSpan(PHRASE, new Set([1, 2]))).toEqual({
      end: 5,
      start: 0,
    });
    expect(selectionSpan(PHRASE, new Set())).toBeNull();
  });
});

describe("sameNotes", () => {
  test("tells a deactivated or less likely note apart", () => {
    const muted = toggleMuted(PHRASE, new Set([1]));
    expect(sameNotes(PHRASE, muted)).toBe(false);
    expect(sameNotes(PHRASE, setChance(PHRASE, new Set([3]), 0.5))).toBe(false);
  });
});

describe("changeLevel", () => {
  test("changes the chance by the same amount, kept within 0…1", () => {
    const notes = setChance(PHRASE, new Set([1]), 0.5);
    expect(
      changeLevel(notes, ALL, "chance", -0.25).map((note) => note.chance)
    ).toEqual([0.25, 0.75, 0.75]);
    expect(changeLevel(notes, ALL, "chance", 2)[0]?.chance).toBe(1);
  });
});

describe("setDeviation", () => {
  test("sets the deviation, kept within -1…1", () => {
    expect(
      setDeviation(PHRASE, new Set([1, 2]), -3).map((note) => note.deviation)
    ).toEqual([-1, -1, undefined]);
  });
});

describe("stretchNotes around an anchor", () => {
  test("stretches back from the end, as far as the roll's start", () => {
    const stretched = stretchNotes(PHRASE, new Set([2, 3]), 2, BOUNDS, 8);
    expect(stretched.slice(1).map((note) => [note.start, note.length])).toEqual(
      [
        [0, 2],
        [4, 4],
      ]
    );
  });
});

describe("deleteTime", () => {
  test("takes the time out, cutting the notes across it", () => {
    expect(
      deleteTime(PHRASE, 1, 5).map((note) => [note.id, note.start, note.length])
    ).toEqual([
      [1, 0, 1],
      [3, 2, 2],
    ]);
  });
});

describe("insertTime", () => {
  test("moves the notes on, and splits the one across", () => {
    expect(
      insertTime(PHRASE, 1, 2, counter(), 16).map((note) => [
        note.id,
        note.start,
        note.length,
      ])
    ).toEqual([
      [1, 0, 1],
      [101, 3, 1],
      [2, 6, 1],
      [3, 8, 2],
    ]);
  });

  test("cuts what it pushes past the clip", () => {
    const pushed = insertTime(PHRASE, 0, 9, counter(), 16);
    expect(pushed.map((note) => [note.start, note.length])).toEqual([
      [9, 2],
      [13, 1],
      [15, 1],
    ]);
  });
});

describe("duplicateTime", () => {
  test("repeats the range after itself, cut to it", () => {
    const { added, notes } = duplicateTime(PHRASE, 0, 5, counter(), 16);
    expect(added).toEqual([101, 102]);
    expect(notes.map((note) => [note.id, note.start, note.length])).toEqual([
      [1, 0, 2],
      [2, 4, 1],
      [3, 11, 2],
      [101, 5, 2],
      [102, 9, 1],
    ]);
  });
});

describe("findNotes", () => {
  test("finds by pitch class, velocity, length and scale", () => {
    expect(findNotes(PHRASE, { pitchClasses: [4, 7] })).toEqual([2, 3]);
    expect(findNotes(PHRASE, { velocity: [0, 0.6] })).toEqual([1]);
    expect(findNotes(PHRASE, { length: [2, 2] })).toEqual([1, 3]);
    expect(
      findNotes(PHRASE, {
        scale: { scale: { name: "minor-pentatonic", root: 0 }, within: false },
      })
    ).toEqual([2]);
  });

  test("takes every other note, or what does not match", () => {
    expect(findNotes(PHRASE, { every: { count: 2, offset: 0 } })).toEqual([
      1, 3,
    ]);
    expect(findNotes(PHRASE, { invert: true, pitchClasses: [0] })).toEqual([
      2, 3,
    ]);
  });
});
