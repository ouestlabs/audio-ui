import { describe, expect, test } from "bun:test";
import {
  barLabelInterval,
  barsBeatsAt,
  DEFAULT_TEMPO,
  describeBarsBeats,
  divisionSeconds,
  gridInterval,
  gridLabel,
  metronomeRhythmSeconds,
  secondsPerBar,
  secondsPerBeat,
} from "@/registry-audio/bases/base/lib/musical-time";

const sixEight = { beatsPerBar: 6, beatUnit: 8, bpm: 120 };

describe("tempo", () => {
  test("a bar of 4/4 at 120 BPM lasts two seconds", () => {
    expect(secondsPerBeat(DEFAULT_TEMPO)).toBe(0.5);
    expect(secondsPerBar(DEFAULT_TEMPO)).toBe(2);
  });

  test("a beat of 6/8 is an eighth note, half a quarter", () => {
    expect(secondsPerBeat(sixEight)).toBe(0.25);
    expect(secondsPerBar(sixEight)).toBe(1.5);
  });
});

describe("divisionSeconds", () => {
  test("bars follow the signature, note values do not", () => {
    expect(divisionSeconds("1-bar", sixEight)).toBe(1.5);
    expect(divisionSeconds("1/4", sixEight)).toBe(0.5);
    expect(divisionSeconds("1/16", DEFAULT_TEMPO)).toBe(0.125);
  });
});

describe("gridInterval", () => {
  test("a fixed division ignores the zoom", () => {
    expect(gridInterval("1/8", 2, DEFAULT_TEMPO)).toBe(0.25);
    expect(gridInterval("1/8", 400, DEFAULT_TEMPO)).toBe(0.25);
  });

  test("adaptive picks the finest division at least 24px apart", () => {
    // At 100px per second a 1/16 (0.125s) is 12.5px: too tight; a 1/8 is 25px
    expect(gridInterval("adaptive", 100, DEFAULT_TEMPO)).toBe(0.25);
    // Zoomed far out it reaches whole bars: at 5px/s two bars are only 20px
    expect(gridInterval("adaptive", 5, DEFAULT_TEMPO)).toBe(8);
  });

  test("triplets are two thirds of the straight division, spaced after the factor", () => {
    expect(
      gridInterval("1/4", 100, DEFAULT_TEMPO, { triplet: true })
    ).toBeCloseTo(1 / 3);
    // 1/8T at 100px/s is 16.7px apart: too tight, so 1/4T
    expect(
      gridInterval("adaptive", 100, DEFAULT_TEMPO, { triplet: true })
    ).toBeCloseTo(1 / 3);
  });
});

describe("barLabelInterval", () => {
  test("labels whole bars, doubling until they are 64px apart", () => {
    expect(barLabelInterval(96, DEFAULT_TEMPO)).toBe(2);
    expect(barLabelInterval(20, DEFAULT_TEMPO)).toBe(4);
    expect(barLabelInterval(5, DEFAULT_TEMPO)).toBe(16);
  });
});

describe("barsBeatsAt", () => {
  test("counts bars, beats and sixteenths from one", () => {
    expect(barsBeatsAt(0, DEFAULT_TEMPO)).toEqual({
      bar: 1,
      beat: 1,
      sixteenth: 1,
    });
    // 4.875s at 120 BPM: bar 3, beat 2, last sixteenth
    expect(barsBeatsAt(4.875, DEFAULT_TEMPO)).toEqual({
      bar: 3,
      beat: 2,
      sixteenth: 4,
    });
  });

  test("lands exactly on a beat despite floating-point error", () => {
    expect(barsBeatsAt(0.1 * 3 + 0.2, DEFAULT_TEMPO).beat).toBe(2);
  });

  test("reads 6/8 in eighth-note beats", () => {
    expect(barsBeatsAt(1.75, sixEight)).toEqual({
      bar: 2,
      beat: 2,
      sixteenth: 1,
    });
  });

  test("reads out for a screen reader", () => {
    expect(describeBarsBeats(4.875, DEFAULT_TEMPO)).toBe("Bar 3, beat 2");
  });
});

describe("gridLabel", () => {
  test("names bars and note values", () => {
    expect(gridLabel(2, DEFAULT_TEMPO)).toBe("1 bar");
    expect(gridLabel(8, DEFAULT_TEMPO)).toBe("4 bars");
    expect(gridLabel(0.125, DEFAULT_TEMPO)).toBe("1/16");
  });

  test("names a triplet as two thirds of its straight division", () => {
    expect(gridLabel(0.25 * (2 / 3), DEFAULT_TEMPO)).toBe("1/8T");
    expect(gridLabel(2 * (2 / 3), DEFAULT_TEMPO)).toBe("1 bar T");
  });

  test("reads out the division the adaptive grid landed on", () => {
    const seconds = gridInterval("adaptive", 100, DEFAULT_TEMPO);
    expect(gridLabel(seconds, DEFAULT_TEMPO)).toBe("1/8");
  });

  test("falls back to beats when nothing named fits", () => {
    expect(gridLabel(0.7, DEFAULT_TEMPO)).toBe("1.4 beats");
  });
});

describe("metronomeRhythmSeconds", () => {
  test("auto has no interval: it is the beat", () => {
    expect(metronomeRhythmSeconds("auto", DEFAULT_TEMPO)).toBeNull();
  });

  test("a note value is a share of a whole note, a bar follows the signature", () => {
    expect(metronomeRhythmSeconds("1/8", DEFAULT_TEMPO)).toBe(0.25);
    expect(metronomeRhythmSeconds("1-bar", sixEight)).toBe(1.5);
  });

  test("a triplet is two thirds of its straight rhythm, and names itself as one", () => {
    const seconds = metronomeRhythmSeconds("1/8t", DEFAULT_TEMPO);
    expect(seconds).toBeCloseTo(0.25 * (2 / 3));
    expect(gridLabel(seconds ?? 0, DEFAULT_TEMPO)).toBe("1/8T");
  });
});
