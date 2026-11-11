import { describe, expect, test } from "bun:test";
import { barsBeatsWith, barsOf, isSignature } from "./meter.ts";
import { DEFAULT_TEMPO } from "./tempo.ts";

// At 120 BPM a quarter is half a second: a 4/4 bar lasts 2 s, a 7/8 bar 1.75 s.
const tempo = DEFAULT_TEMPO;
const lay = (bars: ReturnType<typeof barsOf>) =>
  bars.map((bar) => [
    bar.number,
    bar.start,
    bar.length,
    `${bar.beatsPerBar}/${bar.beatUnit}`,
    bar.partial,
  ]);

describe("barsOf", () => {
  test("without a change, whole bars of the tempo's signature", () => {
    expect(lay(barsOf(tempo, [], 6))).toEqual([
      [1, 0, 2, "4/4", false],
      [2, 2, 2, "4/4", false],
      [3, 4, 2, "4/4", false],
    ]);
  });

  test("a change on a bar line starts bars of its signature there", () => {
    expect(
      lay(barsOf(tempo, [{ at: 4, beatUnit: 8, beatsPerBar: 7 }], 7.5))
    ).toEqual([
      [1, 0, 2, "4/4", false],
      [2, 2, 2, "4/4", false],
      [3, 4, 1.75, "7/8", false],
      [4, 5.75, 1.75, "7/8", false],
    ]);
  });

  test("a change inside a bar cuts it short", () => {
    expect(
      lay(barsOf(tempo, [{ at: 3, beatUnit: 4, beatsPerBar: 3 }], 4.5))
    ).toEqual([
      [1, 0, 2, "4/4", false],
      [2, 2, 1, "4/4", true],
      [3, 3, 1.5, "3/4", false],
    ]);
  });

  test("a change at the start replaces the tempo's signature; one that is not a signature is left out", () => {
    const bars = barsOf(
      tempo,
      [
        { at: 0, beatUnit: 8, beatsPerBar: 6 },
        { at: 1, beatUnit: 3, beatsPerBar: 4 },
      ],
      3
    );
    expect(lay(bars)).toEqual([
      [1, 0, 1.5, "6/8", false],
      [2, 1.5, 1.5, "6/8", false],
    ]);
  });
});

describe("barsBeatsWith", () => {
  test("counts bars, beats and sixteenths through the changes", () => {
    const changes = [{ at: 4, beatUnit: 8, beatsPerBar: 7 }];
    expect(barsBeatsWith(0, tempo, changes)).toEqual({
      bar: 1,
      beat: 1,
      sixteenth: 1,
    });
    // An eighth into the third bar, which is in 7/8: its second beat.
    expect(barsBeatsWith(4.25, tempo, changes)).toEqual({
      bar: 3,
      beat: 2,
      sixteenth: 1,
    });
    // On the line of bar 4.
    expect(barsBeatsWith(5.75, tempo, changes)).toEqual({
      bar: 4,
      beat: 1,
      sixteenth: 1,
    });
  });
});

describe("isSignature", () => {
  test("1 to 99 beats of a whole, half, quarter, eighth or sixteenth", () => {
    expect(isSignature(7, 8)).toBe(true);
    expect(isSignature(0, 4)).toBe(false);
    expect(isSignature(4, 3)).toBe(false);
    expect(isSignature(100, 4)).toBe(false);
  });
});
