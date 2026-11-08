import { describe, expect, test } from "bun:test";
import {
  pocketSynthPitch,
  pocketSynthPosition,
} from "@/registry-audio/bases/base/lib/pocket-synth-device";
import {
  waveShaperPitch,
  waveShaperPosition,
} from "@/registry-audio/bases/base/lib/wave-shaper-device";

describe("a pitch's place on a synth's pad", () => {
  test("is the inverse of the pitch a place plays", () => {
    for (const position of [0, 0.25, 0.5, 1]) {
      expect(pocketSynthPosition(pocketSynthPitch(position))).toBeCloseTo(
        position,
        9
      );
      expect(waveShaperPosition(waveShaperPitch(position))).toBeCloseTo(
        position,
        9
      );
    }
  });

  test("stays inside the pad for a pitch out of its range", () => {
    expect(pocketSynthPosition(10)).toBe(0);
    expect(pocketSynthPosition(5000)).toBe(1);
    expect(waveShaperPosition(20)).toBe(0);
    expect(waveShaperPosition(4000)).toBe(1);
  });
});
