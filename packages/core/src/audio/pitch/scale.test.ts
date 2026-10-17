import { describe, expect, test } from "bun:test";
import { inScale, nearestInScale, SCALES, scalePitchClasses } from "./scale.ts";

describe("SCALES", () => {
  test("start on the root and stay inside one octave, rising", () => {
    for (const steps of Object.values(SCALES)) {
      expect(steps[0]).toBe(0);
      for (let index = 1; index < steps.length; index += 1) {
        expect(steps[index] as number).toBeGreaterThan(
          steps[index - 1] as number
        );
      }
      expect(steps.at(-1) as number).toBeLessThan(12);
    }
  });
});

describe("scalePitchClasses", () => {
  test("C major is the white keys", () => {
    expect(scalePitchClasses({ name: "major", root: 0 })).toEqual([
      0, 2, 4, 5, 7, 9, 11,
    ]);
  });

  test("A minor keeps the same pitch classes as C major", () => {
    expect(scalePitchClasses({ name: "minor", root: 9 })).toEqual(
      scalePitchClasses({ name: "major", root: 0 })
    );
  });

  test("wraps a root past B around the octave", () => {
    expect(scalePitchClasses({ name: "major-pentatonic", root: 14 })).toEqual(
      scalePitchClasses({ name: "major-pentatonic", root: 2 })
    );
  });
});

describe("inScale", () => {
  test("in every octave, and for negative pitches", () => {
    const key = { name: "major", root: 7 } as const;
    expect(inScale(66, key)).toBe(true); // F#
    expect(inScale(65, key)).toBe(false); // F
    expect(inScale(-6, key)).toBe(true); // F#, five octaves down
  });
});

describe("nearestInScale", () => {
  test("keeps a pitch in the key", () => {
    expect(nearestInScale(64, { name: "major", root: 0 })).toBe(64);
  });

  test("moves to the nearest pitch in the key, the lower of two as near", () => {
    const cMajor = { name: "major", root: 0 } as const;
    expect(nearestInScale(61, cMajor)).toBe(60);
    expect(nearestInScale(66, cMajor)).toBe(65);
    const pentatonic = { name: "minor-pentatonic", root: 0 } as const;
    expect(nearestInScale(62, pentatonic)).toBe(63);
    expect(nearestInScale(61, pentatonic)).toBe(60);
  });
});
