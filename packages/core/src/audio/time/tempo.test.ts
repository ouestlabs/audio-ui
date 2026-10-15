import { describe, expect, test } from "bun:test";
import {
  barsBeatsAt,
  bpmToMicrosecondsPerQuarterNote,
  DEFAULT_MICROSECONDS_PER_QUARTER_NOTE,
  DEFAULT_TEMPO,
  describeBarsBeats,
  microsecondsPerQuarterNoteToBpm,
  secondsPerBar,
  secondsPerBeat,
  secondsPerQuarter,
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
