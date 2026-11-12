import { describe, expect, test } from "bun:test";
import { shiftChannels, speedChannels, stretchChannels } from "./time-pitch.ts";

const RATE = 44_100;
const sine = (frequency: number, seconds = 1) =>
  Float32Array.from(
    { length: RATE * seconds },
    (_, index) => 0.5 * Math.sin((2 * Math.PI * frequency * index) / RATE)
  );
/** The frequency of a sine, from its rising zero crossings. */
const frequencyOf = (channel: Float32Array) => {
  let crossings = 0;
  for (let index = 1; index < channel.length; index += 1) {
    if ((channel[index - 1] ?? 0) < 0 && (channel[index] ?? 0) >= 0) {
      crossings += 1;
    }
  }
  return (crossings * RATE) / channel.length;
};

describe("stretchChannels", () => {
  test("twice as slow is about twice as long, at the same pitch", () => {
    const [out] = stretchChannels([sine(440)], RATE, { factor: 2 });
    expect(out?.length ?? 0).toBeGreaterThan(RATE * 1.9);
    expect(out?.length ?? 0).toBeLessThan(RATE * 2.1);
    expect(frequencyOf(out ?? new Float32Array())).toBeGreaterThan(420);
    expect(frequencyOf(out ?? new Float32Array())).toBeLessThan(460);
  });

  test("a factor of one comes back as it is, and each method answers", () => {
    const source = [sine(440, 1)];
    expect(stretchChannels(source, RATE, { factor: 1 })).toEqual(source);
    for (const method of ["pvocLock", "wsola"] as const) {
      const [out] = stretchChannels(source, RATE, { factor: 1.5, method });
      expect(out?.length ?? 0).toBeGreaterThan(RATE * 1.3);
    }
  });
});

describe("shiftChannels", () => {
  test("an octave up doubles the frequency and keeps the length", () => {
    const [out] = shiftChannels([sine(440)], RATE, {
      method: "transient",
      semitones: 12,
    });
    expect(Math.abs((out?.length ?? 0) - RATE)).toBeLessThan(RATE * 0.05);
    expect(frequencyOf(out ?? new Float32Array())).toBeGreaterThan(840);
    expect(frequencyOf(out ?? new Float32Array())).toBeLessThan(920);
  });

  test("no shift comes back as it is", () => {
    const source = [sine(440)];
    expect(shiftChannels(source, RATE, { semitones: 0 })).toEqual(source);
  });
});

describe("speedChannels", () => {
  test("twice as fast is half as long and an octave up", () => {
    const [out] = speedChannels([sine(440)], RATE, 2);
    expect(out?.length).toBe(RATE / 2);
    expect(frequencyOf(out ?? new Float32Array())).toBeGreaterThan(860);
    expect(frequencyOf(out ?? new Float32Array())).toBeLessThan(900);
  });
});
