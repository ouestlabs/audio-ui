import { describe, expect, test } from "bun:test";
import {
  barsBeatsAt,
  bpmToMicrosecondsPerQuarterNote,
  DEFAULT_MICROSECONDS_PER_QUARTER_NOTE,
  DEFAULT_TEMPO,
  describeBarsBeats,
  microsecondsPerQuarterNoteToBpm,
  SYNCED_DIVISIONS,
  secondsPerBar,
  secondsPerBeat,
  secondsPerQuarter,
  syncedSeconds,
} from "./index.ts";

describe("MIDI tempo", () => {
  test("converts BPM and microseconds per quarter note, 120 BPM being 500000", () => {
    expect(bpmToMicrosecondsPerQuarterNote(120)).toBe(500_000);
    expect(microsecondsPerQuarterNoteToBpm(500_000)).toBe(120);
    expect(DEFAULT_MICROSECONDS_PER_QUARTER_NOTE).toBe(500_000);
    expect(
      microsecondsPerQuarterNoteToBpm(bpmToMicrosecondsPerQuarterNote(93))
    ).toBeCloseTo(93, 9);
  });

  test("matches the values of the MIDI file spec's own examples", () => {
    // 0x07A120 is 500000, and 0x0F4240 is a million: 60 BPM.
    expect(microsecondsPerQuarterNoteToBpm(0x07_a1_20)).toBe(120);
    expect(microsecondsPerQuarterNoteToBpm(0x0f_42_40)).toBe(60);
  });
});

describe("a tempo that is not one", () => {
  const bad = [0, -120, Number.NaN, Number.POSITIVE_INFINITY];

  test("makes a quarter note infinitely long, so a position stays at the start", () => {
    for (const bpm of bad) {
      const tempo = { ...DEFAULT_TEMPO, bpm };
      expect(secondsPerQuarter(tempo)).toBe(Number.POSITIVE_INFINITY);
      expect(barsBeatsAt(30, tempo)).toEqual({ bar: 1, beat: 1, sixteenth: 1 });
    }
  });

  test("reads a signature that is not one as 4/4", () => {
    for (const value of [0, -4, Number.NaN]) {
      const tempo = { beatsPerBar: value, beatUnit: value, bpm: 120 };
      expect(secondsPerBar(tempo)).toBe(secondsPerBar(DEFAULT_TEMPO));
      expect(secondsPerBeat(tempo)).toBe(0.5);
      expect(describeBarsBeats(2.5, tempo)).toBe("Bar 2, beat 2");
    }
  });

  test("reads a position that is not a time as the start", () => {
    for (const seconds of [-5, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(barsBeatsAt(seconds, DEFAULT_TEMPO)).toEqual({
        bar: 1,
        beat: 1,
        sixteenth: 1,
      });
    }
  });
});

describe("synced note values", () => {
  const tempo = { beatsPerBar: 4, beatUnit: 4, bpm: 120 };

  test("a quarter is half a second at 120 BPM, an eighth a quarter of one", () => {
    expect(syncedSeconds("1/4", tempo)).toBeCloseTo(0.5, 9);
    expect(syncedSeconds("1/8", tempo)).toBeCloseTo(0.25, 9);
    expect(syncedSeconds("1/1", tempo)).toBeCloseTo(2, 9);
  });

  test("a triplet is two thirds of its note and a dotted note one and a half", () => {
    expect(syncedSeconds("1/8t", tempo)).toBeCloseTo((0.25 * 2) / 3, 9);
    expect(syncedSeconds("1/8d", tempo)).toBeCloseTo(0.375, 9);
  });

  test("it follows the tempo", () => {
    expect(syncedSeconds("1/4", { ...tempo, bpm: 60 })).toBeCloseTo(1, 9);
    expect(syncedSeconds("1/16", { ...tempo, bpm: 240 })).toBeCloseTo(
      0.0625,
      9
    );
  });

  test("every listed value reads, and a stale one falls back to a quarter", () => {
    for (const { value } of SYNCED_DIVISIONS) {
      expect(syncedSeconds(value, tempo)).toBeGreaterThan(0);
    }
    expect(syncedSeconds("1/7x", tempo)).toBeCloseTo(0.5, 9);
    expect(new Set(SYNCED_DIVISIONS.map(({ value }) => value)).size).toBe(
      SYNCED_DIVISIONS.length
    );
  });

  test("the list starts at the shortest note and ends at the longest, each in three forms", () => {
    expect(SYNCED_DIVISIONS[0]?.value).toBe("1/32t");
    expect(SYNCED_DIVISIONS.at(-1)?.value).toBe("1/1d");
    expect(SYNCED_DIVISIONS).toHaveLength(18);
  });
});
