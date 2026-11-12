import { describe, expect, test } from "bun:test";
import { REPAIRS, repairChannels } from "./index.ts";

const RATE = 16_000;
const tone = (frequency: number, amplitude: number, seconds = 1) =>
  Float32Array.from(
    { length: RATE * seconds },
    (_, index) => amplitude * Math.sin((2 * Math.PI * frequency * index) / RATE)
  );
const rmsOf = (channel: Float32Array) =>
  Math.sqrt(
    channel.reduce((sum, sample) => sum + sample * sample, 0) / channel.length
  );
const mix = (a: Float32Array, b: Float32Array) =>
  a.map((sample, index) => sample + (b[index] ?? 0));

describe("repairChannels", () => {
  test("takes the mains hum out and leaves the voice band", () => {
    const voice = tone(800, 0.2, 2);
    const hum = tone(60, 0.2, 2);
    const [out] = repairChannels([mix(voice, hum)], RATE, "hum60");
    const residue = (out ?? new Float32Array()).map(
      (sample, index) => sample - (voice[index] ?? 0)
    );
    expect(rmsOf(residue.subarray(RATE / 2))).toBeLessThan(rmsOf(hum) * 0.5);
  });

  test("keeps the length and the channel count, and never touches its source", () => {
    const source = [tone(440, 0.3), tone(330, 0.3)];
    const copy = source.map((channel) => Float32Array.from(channel));
    for (const repair of ["clicks", "clipping", "noise"] as const) {
      const out = repairChannels(source, RATE, repair);
      expect(out).toHaveLength(2);
      expect(out[0]?.length).toBe(RATE);
    }
    expect(source).toEqual(copy);
  });

  test("lists every repair it has a method for", () => {
    for (const repair of REPAIRS) {
      expect(() =>
        repairChannels([tone(440, 0.1, 1)], RATE, repair)
      ).not.toThrow();
    }
  });
});
