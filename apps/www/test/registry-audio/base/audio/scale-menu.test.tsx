import { describe, expect, test } from "bun:test";
import { detectKeys } from "@/registry-audio/bases/base/audio/elements/scale-menu";

/** Notes of a progression, each a beat long: the chords' tones, as a song in that key plays them. */
const chords = (...pitches: readonly (readonly number[])[]) =>
  pitches.flatMap((chord) => chord.map((pitch) => ({ length: 1, pitch })));

describe("detectKeys", () => {
  test("reads C major from I-IV-V-I, the likeliest first, three at most", () => {
    const keys = detectKeys(
      chords([60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67])
    );
    expect(keys[0]).toEqual({ name: "major", root: 0 });
    expect(keys).toHaveLength(3);
  });

  test("reads A minor from i-iv-v-i", () => {
    const keys = detectKeys(
      chords([57, 60, 64], [62, 65, 69], [64, 67, 71], [57, 60, 64])
    );
    expect(keys[0]).toEqual({ name: "minor", root: 9 });
  });

  test("a note counts for as long as it sounds, and a muted one not at all", () => {
    const held = [
      ...chords([57, 60, 64], [57, 60, 64]),
      // A long C major chord, muted: it would turn the key to C.
      ...[60, 64, 67].map((pitch) => ({ length: 40, muted: true, pitch })),
    ];
    expect(detectKeys(held)[0]).toEqual({ name: "minor", root: 9 });
  });

  test("offers none for no notes, or a single pitch class, which is in every key", () => {
    expect(detectKeys([])).toEqual([]);
    expect(
      detectKeys([
        { length: 1, pitch: 60 },
        { length: 2, pitch: 72 },
      ])
    ).toEqual([]);
  });

  test("gives as many as asked", () => {
    expect(detectKeys(chords([62, 66, 69]), 1)).toHaveLength(1);
  });
});
