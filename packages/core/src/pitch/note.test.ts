import { describe, expect, test } from "bun:test";
import {
  CONCERT_PITCH_HZ,
  frequencyToNote,
  nearestNote,
  noteToFrequency,
} from "./note.ts";

describe("noteToFrequency", () => {
  test("puts A4, note 69, at concert pitch", () => {
    expect(CONCERT_PITCH_HZ).toBe(440);
    expect(noteToFrequency(69)).toBe(440);
  });

  test("matches the MIDI reference table, to the hundredth of a hertz", () => {
    const table: [number, number][] = [
      [0, 8.18],
      [21, 27.5],
      [36, 65.41],
      [60, 261.63],
      [81, 880],
      [108, 4186.01],
      [127, 12_543.85],
    ];
    for (const [note, hz] of table) {
      expect(noteToFrequency(note)).toBeCloseTo(hz, 2);
    }
  });

  test("doubles every octave, and takes a fractional note", () => {
    expect(noteToFrequency(81) / noteToFrequency(69)).toBeCloseTo(2, 12);
    expect(noteToFrequency(69.5)).toBeCloseTo(440 * 2 ** (1 / 24), 9);
  });

  test("follows the reference pitch", () => {
    expect(noteToFrequency(69, 432)).toBe(432);
    expect(noteToFrequency(57, 415)).toBeCloseTo(207.5, 9);
  });

  test("is NaN for what is not a note or a reference", () => {
    expect(noteToFrequency(Number.NaN)).toBeNaN();
    expect(noteToFrequency(Number.POSITIVE_INFINITY)).toBeNaN();
    expect(noteToFrequency(60, 0)).toBeNaN();
    expect(noteToFrequency(60, -440)).toBeNaN();
  });
});

describe("frequencyToNote", () => {
  test("is the inverse of noteToFrequency", () => {
    for (const note of [0, 12.25, 33.7, 60, 69, 100.5, 127]) {
      expect(frequencyToNote(noteToFrequency(note))).toBeCloseTo(note, 9);
      expect(frequencyToNote(noteToFrequency(note, 432), 432)).toBeCloseTo(
        note,
        9
      );
    }
  });

  test("is NaN for a frequency that is not positive and finite", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(frequencyToNote(bad)).toBeNaN();
    }
  });
});

describe("nearestNote", () => {
  test("names concert A", () => {
    expect(nearestNote(440)).toEqual({
      cents: 0,
      name: "A",
      octave: 4,
      pitch: 69,
    });
  });

  test("names middle C as C4, note 60", () => {
    const note = nearestNote(261.63);
    expect([note?.name, note?.octave, note?.pitch]).toEqual(["C", 4, 60]);
    expect(Math.abs(note?.cents ?? 99)).toBeLessThan(0.1);
  });

  test("measures how sharp or flat in cents", () => {
    expect(nearestNote(440 * 2 ** (20 / 1200))?.cents).toBeCloseTo(20, 6);
    expect(nearestNote(440 * 2 ** (-35 / 1200))?.cents).toBeCloseTo(-35, 6);
  });

  test("rounds to the nearest note, so cents never pass 50", () => {
    const note = nearestNote(440 * 2 ** (60 / 1200));
    expect(note?.name).toBe("A#");
    expect(note?.cents).toBeCloseTo(-40, 6);
    for (let cents = -49; cents <= 49; cents += 7) {
      const found = nearestNote(440 * 2 ** (cents / 1200));
      expect(found?.name).toBe("A");
      expect(Math.abs(found?.cents ?? 99)).toBeLessThanOrEqual(50);
    }
  });

  test("names the lowest and highest notes of a piano and of MIDI", () => {
    expect(nearestNote(27.5)).toMatchObject({ name: "A", octave: 0 });
    expect(nearestNote(4186.01)).toMatchObject({ name: "C", octave: 8 });
    expect(nearestNote(8.1758)).toMatchObject({
      name: "C",
      octave: -1,
      pitch: 0,
    });
  });

  test("follows the reference pitch", () => {
    expect(nearestNote(432, 432)).toMatchObject({ cents: 0, name: "A" });
    expect(nearestNote(432)?.cents).toBeLessThan(-30);
  });

  test("is null for silence and for what is not a frequency", () => {
    for (const bad of [0, -440, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(nearestNote(bad)).toBeNull();
    }
    expect(nearestNote(440, 0)).toBeNull();
  });
});
