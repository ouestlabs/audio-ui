import { describe, expect, test } from "bun:test";
import { rollRows } from "./rows.js";

describe("rollRows", () => {
  test("draws every pitch, highest first, unfolded", () => {
    const rows = rollRows([], 60, 63, false);
    expect(rows.folded).toBe(false);
    expect(rows.pitches).toEqual([63, 62, 61, 60]);
    expect(rows.rowOf(62)).toBe(1);
    expect(rows.pitchAt(3)).toBe(60);
    expect(rows.step(62, 1)).toBe(61);
  });

  test("folds onto the pitches the notes use, inside the range", () => {
    const rows = rollRows(
      [
        { pitch: 64 },
        { pitch: 60 },
        { pitch: 67 },
        { pitch: 64 },
        { pitch: 90 },
      ],
      48,
      72,
      true
    );
    expect(rows.folded).toBe(true);
    expect(rows.pitches).toEqual([67, 64, 60]);
  });

  test("steps folded rows by row, carrying on by semitones past either end", () => {
    const rows = rollRows(
      [{ pitch: 64 }, { pitch: 60 }, { pitch: 67 }],
      48,
      72,
      true
    );
    expect(rows.step(67, 1)).toBe(64);
    expect(rows.step(64, 1)).toBe(60);
    expect(rows.step(60, 2)).toBe(58);
    expect(rows.step(67, -1)).toBe(68);
  });

  test("puts a pitch without a row on the row it would be inserted at", () => {
    const rows = rollRows([{ pitch: 64 }, { pitch: 60 }], 48, 72, true);
    expect(rows.rowOf(62)).toBe(1);
    expect(rows.rowOf(70)).toBe(0);
    expect(rows.rowOf(50)).toBe(2);
  });

  test("keeps every row when there is nothing to fold onto", () => {
    expect(rollRows([], 60, 63, true).folded).toBe(false);
  });
});
