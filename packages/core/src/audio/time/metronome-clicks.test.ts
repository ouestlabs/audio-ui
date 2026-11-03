import { describe, expect, test } from "bun:test";
import { metronomeClicks } from "./meter.ts";

/** A bar of 4/4 lasts 2 s at 120 BPM, a beat 0.5 s. */
const TEMPO = { beatUnit: 4, beatsPerBar: 4, bpm: 120 };
const times = (clicks: { at: number }[]) => clicks.map((click) => click.at);

describe("metronomeClicks", () => {
  test("TRN-016: on each beat, the first of a bar accented", () => {
    expect(metronomeClicks(TEMPO, [], 2.5)).toEqual([
      { accent: true, at: 0 },
      { accent: false, at: 0.5 },
      { accent: false, at: 1 },
      { accent: false, at: 1.5 },
      { accent: true, at: 2 },
    ]);
  });

  test("TRN-016: a beat is the signature's: 6/8 clicks on its eighths", () => {
    const clicks = metronomeClicks(
      { beatUnit: 8, beatsPerBar: 6, bpm: 120 },
      [],
      1.5
    );
    expect(times(clicks)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25]);
    expect(clicks.filter((click) => click.accent)).toHaveLength(1);
  });

  test("TRN-016: a time-signature change counts on from where it is put", () => {
    const clicks = metronomeClicks(
      TEMPO,
      [{ at: 2, beatUnit: 8, beatsPerBar: 3 }],
      3.5
    );
    expect(times(clicks)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25,
    ]);
    expect(times(clicks.filter((click) => click.accent))).toEqual([0, 2, 2.75]);
  });

  test("TRN-016: a change that cuts a bar short starts a new bar on an accent", () => {
    const clicks = metronomeClicks(
      TEMPO,
      [{ at: 1.25, beatUnit: 4, beatsPerBar: 4 }],
      2
    );
    expect(times(clicks)).toEqual([0, 0.5, 1, 1.25, 1.75]);
    expect(times(clicks.filter((click) => click.accent))).toEqual([0, 1.25]);
  });

  test("TRN-016: a rhythm sets the interval, and each bar starts it again", () => {
    expect(times(metronomeClicks(TEMPO, [], 1, "1/8"))).toEqual([
      0, 0.25, 0.5, 0.75,
    ]);
    expect(times(metronomeClicks(TEMPO, [], 5, "1-bar"))).toEqual([0, 2, 4]);
    const triplets = metronomeClicks(TEMPO, [], 2, "1/4t");
    expect(triplets).toHaveLength(6);
    expect(triplets[3]?.at).toBeCloseTo(1, 10);
  });

  test("TRN-016: one bar's click for each bar of its own length, whatever the signature", () => {
    expect(
      times(
        metronomeClicks(
          TEMPO,
          [{ at: 2, beatUnit: 8, beatsPerBar: 3 }],
          4,
          "1-bar"
        )
      )
    ).toEqual([0, 2, 2.75, 3.5]);
  });

  test("nothing at or past the end, and nothing for no time", () => {
    expect(times(metronomeClicks(TEMPO, [], 1))).toEqual([0, 0.5]);
    expect(metronomeClicks(TEMPO, [], 0)).toEqual([]);
  });
});
