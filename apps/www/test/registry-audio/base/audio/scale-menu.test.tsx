import { describe, expect, test } from "bun:test";
import { detectKeys } from "@/registry-audio/bases/base/audio/elements/scale-menu";
import { audioChroma } from "@/registry-audio/bases/base/lib/arrangement";

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

describe("audioChroma", () => {
  const RATE = 48_000;
  /** Seconds of sines at `hertz`, in both channels, with a silent second before them. */
  const tones = (hertz: readonly number[], seconds: number) => {
    const silence = RATE;
    const data = new Float32Array(silence + seconds * RATE);
    for (let frame = 0; frame < seconds * RATE; frame += 1) {
      data[silence + frame] = hertz.reduce(
        (sum, each) =>
          sum + 0.2 * Math.sin((2 * Math.PI * each * frame) / RATE),
        0
      );
    }
    return [data, data];
  };

  test("finds the pitch classes a recording sounds, summing to 1, and skips its silence", () => {
    // A minor: A3, C4, E4.
    const read = audioChroma(tones([220, 261.63, 329.63], 2), RATE);
    expect(read.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 6);
    const loudest = read
      .map((value, pitchClass) => ({ pitchClass, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((each) => each.pitchClass)
      .sort((a, b) => a - b);
    expect(loudest).toEqual([0, 4, 9]);
  });

  test("reads nothing in silence", () => {
    expect(audioChroma([new Float32Array(RATE)], RATE)).toEqual(
      new Array(12).fill(0)
    );
  });

  test("a key is read from sound alone, as from notes", () => {
    // I-IV-V in G major, a second each.
    const chords = [
      [196, 246.94, 293.66],
      [261.63, 329.63, 392],
      [293.66, 369.99, 440],
      [196, 246.94, 293.66],
    ];
    const sum = new Array(12).fill(0);
    for (const chord of chords) {
      const read = audioChroma(tones(chord, 1), RATE);
      for (const [at, value] of read.entries()) {
        sum[at] += value;
      }
    }
    expect(detectKeys([], 3, sum)[0]).toEqual({ name: "major", root: 7 });
  });
});
