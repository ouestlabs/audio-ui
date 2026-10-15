import { describe, expect, test } from "bun:test";
import {
  detectPitch,
  nearestNote,
  noteFrequency,
} from "@/registry-audio/bases/base/lib/pitch-detection";

const SAMPLE_RATE = 48_000;
const SIZE = 4096;

/** `SIZE` samples of a sine, or of its first harmonics, at `frequency`. */
function tone(frequency: number, harmonics = 1, amplitude = 0.5) {
  const samples = new Float32Array(SIZE);
  for (let index = 0; index < SIZE; index += 1) {
    for (let harmonic = 1; harmonic <= harmonics; harmonic += 1) {
      samples[index] =
        (samples[index] ?? 0) +
        (amplitude / harmonic) *
          Math.sin((2 * Math.PI * frequency * harmonic * index) / SAMPLE_RATE);
    }
  }
  return samples;
}

describe("detectPitch", () => {
  test("finds a sine's frequency, to a fraction of a cent", () => {
    for (const frequency of [82.41, 110, 261.63, 440, 987.77]) {
      const found = detectPitch(tone(frequency), SAMPLE_RATE);
      expect(found).not.toBeNull();
      const cents = 1200 * Math.log2((found?.frequency ?? 1) / frequency);
      expect(Math.abs(cents)).toBeLessThan(1);
    }
  });

  test("finds the fundamental of a tone rich in harmonics, not the loudest harmonic", () => {
    const found = detectPitch(tone(196, 6), SAMPLE_RATE);
    expect(found?.frequency).toBeCloseTo(196, 0);
  });

  test("is confident about a clean tone", () => {
    expect(detectPitch(tone(440), SAMPLE_RATE)?.confidence).toBeGreaterThan(
      0.95
    );
  });

  test("hears nothing in silence or below the level floor", () => {
    expect(detectPitch(new Float32Array(SIZE), SAMPLE_RATE)).toBeNull();
    expect(detectPitch(tone(440, 1, 0.001), SAMPLE_RATE)).toBeNull();
  });

  test("hears nothing in noise", () => {
    let seed = 1;
    const noise = Float32Array.from({ length: SIZE }, () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return (seed / 2_147_483_647 - 0.5) * 0.5;
    });
    expect(detectPitch(noise, SAMPLE_RATE)).toBeNull();
  });

  test("searches no higher than maxHz", () => {
    // A 440 Hz sine also repeats every two periods: the octave below is in range.
    const found = detectPitch(tone(440), SAMPLE_RATE, { maxHz: 300 });
    expect(found?.frequency).toBeCloseTo(220, 0);
    for (const frequency of [330, 700, 1000, 1500]) {
      const above = detectPitch(tone(frequency), SAMPLE_RATE, { maxHz: 300 });
      // The search stops at maxHz's lag; the result between two samples may land a hair past it.
      expect(above?.frequency ?? 0).toBeLessThan(301);
    }
  });

  test("searches no lower than minHz", () => {
    expect(detectPitch(tone(110), SAMPLE_RATE, { minHz: 200 })).toBeNull();
  });

  test("needs two periods of a pitch in its samples to hear it", () => {
    // 256 samples hold two periods of 440 Hz (109 samples), not of 110 Hz (436).
    expect(detectPitch(tone(440).slice(0, 256), SAMPLE_RATE)).not.toBeNull();
    expect(detectPitch(tone(110).slice(0, 256), SAMPLE_RATE)).toBeNull();
  });
});

describe("nearestNote", () => {
  test("names concert A", () => {
    expect(nearestNote(440)).toEqual({
      cents: 0,
      name: "A",
      octave: 4,
      pitch: 69,
    });
  });

  test("names middle C", () => {
    const note = nearestNote(261.63);
    expect([note.name, note.octave, note.pitch]).toEqual(["C", 4, 60]);
    expect(Math.abs(note.cents)).toBeLessThan(0.1);
  });

  test("measures how sharp or flat in cents", () => {
    expect(nearestNote(440 * 2 ** (20 / 1200)).cents).toBeCloseTo(20, 5);
    expect(nearestNote(440 * 2 ** (-35 / 1200)).cents).toBeCloseTo(-35, 5);
  });

  test("rounds to the nearest note, never beyond 50 cents", () => {
    // 60 cents above A4 is 40 below A#4.
    const note = nearestNote(440 * 2 ** (60 / 1200));
    expect(note.name).toBe("A#");
    expect(note.cents).toBeCloseTo(-40, 5);
  });

  test("follows the reference pitch", () => {
    expect(nearestNote(432, 432)).toMatchObject({ cents: 0, name: "A" });
    expect(nearestNote(432).cents).toBeLessThan(-30);
  });

  test("names notes below the first octave", () => {
    const note = nearestNote(41.2);
    expect([note.name, note.octave]).toEqual(["E", 1]);
  });
});

describe("noteFrequency", () => {
  test("is the inverse of nearestNote", () => {
    expect(noteFrequency(69)).toBe(440);
    expect(noteFrequency(60)).toBeCloseTo(261.63, 2);
    const back = nearestNote(noteFrequency(52, 17));
    expect([back.pitch, Math.round(back.cents)]).toEqual([52, 17]);
  });
});
