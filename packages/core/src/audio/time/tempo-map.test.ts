import { describe, expect, test } from "bun:test";
import { parseMidiFile } from "../midi/index.ts";
import { secondsToTicks, ticksToSeconds } from "./index.ts";

const PPQ = 480;

describe("ticksToSeconds", () => {
  test("is 120 BPM, half a second a quarter note, with no tempo given", () => {
    expect(ticksToSeconds(0, PPQ)).toBe(0);
    expect(ticksToSeconds(PPQ, PPQ)).toBe(0.5);
    expect(ticksToSeconds(PPQ * 4, PPQ)).toBe(2);
    expect(ticksToSeconds(PPQ / 2, PPQ)).toBe(0.25);
  });

  test("uses a Set Tempo at tick 0 in place of the default", () => {
    const tempos = [{ microsecondsPerQuarterNote: 1_000_000, tick: 0 }];
    expect(ticksToSeconds(PPQ, PPQ, tempos)).toBe(1);
  });

  test("keeps the default until the first Set Tempo", () => {
    const tempos = [{ microsecondsPerQuarterNote: 1_000_000, tick: PPQ * 4 }];
    // Four quarters at 120 BPM, then one more at 60.
    expect(ticksToSeconds(PPQ * 4, PPQ, tempos)).toBe(2);
    expect(ticksToSeconds(PPQ * 5, PPQ, tempos)).toBe(3);
  });

  test("sums each stretch at the tempo that held over it", () => {
    const tempos = [
      { microsecondsPerQuarterNote: 500_000, tick: 0 },
      { microsecondsPerQuarterNote: 250_000, tick: PPQ * 2 },
      { microsecondsPerQuarterNote: 1_000_000, tick: PPQ * 4 },
    ];
    // 2 quarters at 0.5 s, 2 at 0.25 s, then 2 at 1 s.
    expect(ticksToSeconds(PPQ * 2, PPQ, tempos)).toBe(1);
    expect(ticksToSeconds(PPQ * 4, PPQ, tempos)).toBe(1.5);
    expect(ticksToSeconds(PPQ * 6, PPQ, tempos)).toBe(3.5);
  });

  test("does not depend on the order the changes are given in", () => {
    const tempos = [
      { microsecondsPerQuarterNote: 1_000_000, tick: PPQ * 4 },
      { microsecondsPerQuarterNote: 250_000, tick: PPQ * 2 },
    ];
    expect(ticksToSeconds(PPQ * 6, PPQ, tempos)).toBe(
      ticksToSeconds(PPQ * 6, PPQ, [...tempos].reverse())
    );
    expect(ticksToSeconds(PPQ * 6, PPQ, tempos)).toBe(3.5 + 0); // 1 + 0.5 + 2
  });

  test("lets the last of two changes on one tick win", () => {
    const tempos = [
      { microsecondsPerQuarterNote: 250_000, tick: PPQ },
      { microsecondsPerQuarterNote: 1_000_000, tick: PPQ },
    ];
    expect(ticksToSeconds(PPQ * 2, PPQ, tempos)).toBe(0.5 + 1);
  });

  test("is NaN for what is not a position or a division", () => {
    expect(ticksToSeconds(-1, PPQ)).toBeNaN();
    expect(ticksToSeconds(Number.NaN, PPQ)).toBeNaN();
    expect(ticksToSeconds(10, 0)).toBeNaN();
    expect(ticksToSeconds(10, -480)).toBeNaN();
  });

  test("leaves out a change that is not a tempo", () => {
    const tempos = [
      { microsecondsPerQuarterNote: 0, tick: 0 },
      { microsecondsPerQuarterNote: Number.NaN, tick: 10 },
      { microsecondsPerQuarterNote: 1_000_000, tick: -5 },
    ];
    expect(ticksToSeconds(PPQ, PPQ, tempos)).toBe(0.5);
  });
});

describe("secondsToTicks", () => {
  test("is the inverse of ticksToSeconds, through a tempo map", () => {
    const tempos = [
      { microsecondsPerQuarterNote: 500_000, tick: 0 },
      { microsecondsPerQuarterNote: 333_333, tick: 960 },
      { microsecondsPerQuarterNote: 1_200_000, tick: 3000 },
    ];
    for (const tick of [
      0, 1, 480, 959, 960, 1500, 2999.5, 3000, 5000, 100_000,
    ]) {
      const seconds = ticksToSeconds(tick, PPQ, tempos);
      expect(secondsToTicks(seconds, PPQ, tempos)).toBeCloseTo(tick, 6);
    }
  });

  test("is 960 ticks a second at 120 BPM and 480 ticks per quarter note", () => {
    expect(secondsToTicks(1, PPQ)).toBe(960);
  });

  test("is NaN for what is not a position", () => {
    expect(secondsToTicks(-1, PPQ)).toBeNaN();
    expect(secondsToTicks(Number.POSITIVE_INFINITY, PPQ)).toBeNaN();
    expect(secondsToTicks(1, 0)).toBeNaN();
  });
});

describe("with a parsed MIDI file", () => {
  test("puts a note on the second it sounds at, through the file's own tempo map", () => {
    // Division 96. Tempo 120 BPM, then 60 BPM at tick 192 (two quarter notes in).
    // A note on at tick 288: two quarters at 0.5 s, then one at 1 s.
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96, 0x4d, 0x54, 0x72,
      0x6b, 0, 0, 0, 27, 0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20, 0x81, 0x40, 0xff,
      0x51, 3, 0x0f, 0x42, 0x40, 0x60, 0x90, 60, 100, 0x60, 0x80, 60, 0, 0,
      0xff, 0x2f, 0,
    ]);
    const parsed = parseMidiFile(bytes);
    expect(parsed.tempos.map((tempo) => tempo.tick)).toEqual([0, 192]);
    const [note] = parsed.notes;
    expect(note?.startTick).toBe(288);
    const start = ticksToSeconds(
      note?.startTick ?? 0,
      parsed.ticksPerQuarterNote,
      parsed.tempos
    );
    const end = ticksToSeconds(
      (note?.startTick ?? 0) + (note?.durationTicks ?? 0),
      parsed.ticksPerQuarterNote,
      parsed.tempos
    );
    expect(start).toBe(2);
    expect(end - start).toBe(1);
  });
});
