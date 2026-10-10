import { describe, expect, test } from "bun:test";
import { isBlackKey, pitchName } from "./pitch";

describe("pitchName", () => {
  test("names middle C C4 and counts octaves from C", () => {
    expect(pitchName(60)).toBe("C4");
    expect(pitchName(61)).toBe("C#4");
    expect(pitchName(59)).toBe("B3");
    expect(pitchName(0)).toBe("C-1");
  });
});

describe("isBlackKey", () => {
  test("follows the piano's pattern in every octave", () => {
    const octave = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71];
    expect(octave.map(isBlackKey)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
    expect(isBlackKey(1)).toBe(true);
  });
});
