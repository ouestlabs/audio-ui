import { describe, expect, test } from "bun:test";
import { analyzeBeat } from "./recording.ts";

describe("CLP-018: the beat a recording comes in with", () => {
  const RATE = 48_000;

  /** A seeded noise generator: the same hits every run. */
  function noiseFrom(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
      return (state / 0x7f_ff_ff_ff) * 2 - 1;
    };
  }

  /** `seconds` of a kick on each odd beat and a snare on each even one at `bpm`, from `start`. */
  function groove(bpm: number, seconds: number, start: number) {
    const data = new Float32Array(seconds * RATE);
    const noise = noiseFrom(1);
    const beat = 60 / bpm;
    for (let index = 0; start + index * beat < seconds; index += 1) {
      const from = Math.round((start + index * beat) * RATE);
      for (
        let frame = 0;
        frame < 0.25 * RATE && from + frame < data.length;
        frame += 1
      ) {
        const time = frame / RATE;
        const sound =
          index % 2 === 0
            ? 0.9 * Math.sin(2 * Math.PI * 55 * time)
            : 0.5 * noise();
        data[from + frame] =
          (data[from + frame] as number) + sound * Math.exp(-time * 20);
      }
    }
    return data;
  }

  test("a tempo between whole BPM is read to a hundredth, with its first beat", () => {
    const { estimate, transients } = analyzeBeat(
      [groove(127.3, 60, 0.4)],
      RATE
    );
    expect(estimate?.bpm).toBeCloseTo(127.3, 2);
    expect(estimate?.firstBeat).toBeCloseTo(0.4, 3);
    expect(transients.length).toBeGreaterThan(100);
  });

  test("a stereo recording is read from its mix", () => {
    const left = groove(93.7, 40, 0.25);
    const { estimate } = analyzeBeat(
      [left, left.map((sample) => sample * 0.5)],
      RATE
    );
    expect(estimate?.bpm).toBeCloseTo(93.7, 2);
  });

  test("silence and noise have no tempo", () => {
    const noise = noiseFrom(9);
    expect(analyzeBeat([new Float32Array(4 * RATE)], RATE)).toEqual({
      estimate: null,
      transients: [],
    });
    expect(
      analyzeBeat(
        [Float32Array.from({ length: 10 * RATE }, () => 0.2 * noise())],
        RATE
      ).estimate
    ).toBeNull();
  });
});
