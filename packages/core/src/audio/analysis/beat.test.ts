import { describe, expect, test } from "bun:test";
import { warpedTime } from "../time/warp.ts";
import { autoWarp, detectTransients, estimateTempo } from "./beat.ts";

const RATE = 48_000;

/** A drum-like hit: a short decaying tone, loud on the beat and softer off it. */
function hit(data: Float32Array, at: number, gain: number, hz: number) {
  const from = Math.round(at * RATE);
  const length = Math.round(0.12 * RATE);
  for (
    let index = 0;
    index < length && from + index < data.length;
    index += 1
  ) {
    const time = index / RATE;
    data[from + index] =
      (data[from + index] as number) +
      gain * Math.exp(-time * 40) * Math.sin(2 * Math.PI * hz * time);
  }
}

/** `seconds` of a beat at `bpm` from `start`: a kick on each bar's first beat, a snare on the others, a hat between. */
function groove(bpm: number, seconds: number, start = 0) {
  const data = new Float32Array(Math.round(seconds * RATE));
  const beat = 60 / bpm;
  for (let index = 0; start + index * beat < seconds; index += 1) {
    const at = start + index * beat;
    hit(data, at, index % 4 === 0 ? 0.9 : 0.6, index % 4 === 0 ? 60 : 180);
    if (at + beat / 2 < seconds) {
      hit(data, at + beat / 2, 0.25, 3000);
    }
  }
  return [data, data];
}

function noise(seconds: number) {
  // A seeded generator (mulberry32): the same noise every run, with no cycle a beat could be read in.
  let seed = 7;
  const next = () => {
    seed = (seed + 0x6d_2b_79_f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  const data = Float32Array.from(
    { length: seconds * RATE },
    () => next() * 0.6 - 0.3
  );
  return [data, data];
}

describe("CLP-018: transients and tempo", () => {
  test("finds each hit to within a millisecond of where it starts", () => {
    const data = new Float32Array(RATE * 2);
    const times = [0.1, 0.45, 0.8123, 1.5];
    for (const time of times) {
      hit(data, time, 0.8, 200);
    }
    const found = detectTransients([data], RATE);
    expect(found).toHaveLength(times.length);
    for (const [index, time] of times.entries()) {
      expect(Math.abs((found[index] as number) - time)).toBeLessThan(0.001);
    }
  });

  test("reads a groove's tempo, and the octave nearest 120 BPM", () => {
    for (const bpm of [84, 100, 128, 150]) {
      const estimate = estimateTempo(groove(bpm, 12), RATE);
      expect(estimate).not.toBeNull();
      expect(Math.abs((estimate?.bpm ?? 0) - bpm)).toBeLessThan(bpm * 0.005);
    }
  });

  test("places the first beat where the groove starts", () => {
    const estimate = estimateTempo(groove(110, 12, 0.6), RATE);
    expect(Math.abs((estimate?.firstBeat ?? 0) - 0.6)).toBeLessThan(0.003);
  });

  test("gives no tempo to noise, or to a single hit", () => {
    expect(estimateTempo(noise(6), RATE)).toBeNull();
    const single = new Float32Array(RATE * 4);
    hit(single, 0.2, 0.9, 80);
    expect(estimateTempo([single], RATE)).toBeNull();
  });
});

describe("CLP-019: warp on import", () => {
  test("a short loop takes the tempo its length gives, marked at its start and end", () => {
    // Two bars at 95 BPM, cut exactly.
    const duration = (2 * 4 * 60) / 95;
    const channels = groove(95, duration);
    const estimate = estimateTempo(channels, RATE);
    const warped = autoWarp({ duration, estimate, tempo: 120 });
    expect(warped?.bpm).toBeCloseTo(95, 9);
    expect(warped?.offset).toBe(0);
    expect(warped?.warp).toEqual([
      { source: 0, target: 0 },
      { source: duration, target: (2 * 4 * 60) / 120 },
    ]);
  });

  test("a longer file gets a marker on each bar's first beat, and starts on the first", () => {
    const channels = groove(128, 40, 0.5);
    const estimate = estimateTempo(channels, RATE);
    const transients = detectTransients(channels, RATE);
    const warped = autoWarp({ duration: 40, estimate, tempo: 120, transients });
    const bar = (4 * 60) / 128;
    expect(warped).not.toBeNull();
    const markers = warped?.warp ?? [];
    expect(markers.length).toBe(Math.floor((40 - 0.5) / bar) + 1);
    for (const [index, marker] of markers.entries()) {
      expect(Math.abs(marker.source - (0.5 + index * bar))).toBeLessThan(0.003);
    }
    // At 120 BPM each bar lasts 2 s on the clip, and the clip starts on the first beat.
    expect(warpedTime(markers, markers[1]?.source ?? 0)).toBeCloseTo(
      (warped?.offset ?? 0) + 2,
      9
    );
    expect(warpedTime(markers, 0.5)).toBeCloseTo(warped?.offset ?? 0, 2);
  });

  test("a file with no tempo is not warped", () => {
    expect(autoWarp({ duration: 6, estimate: null, tempo: 120 })).toBeNull();
  });
});
