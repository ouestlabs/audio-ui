import { describe, expect, test } from "bun:test";
import { unlimitDeficitGain, unlimitGain } from "@audio/dynamics-unlimit";
import { unlimit } from "@audio/dynamics-unlimit/audio";
import {
  UNLIMITER_WORKLET,
  unlimiterDevice,
  unlimiterLift,
  unlimiterSettings,
  unlimiterUnused,
} from "@/registry-audio/bases/base/devices/unlimiter/device";
import { madeProcessor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = unlimiterDevice.defaults();

/** Hits over a held tone: attacks to lift. */
const hits = (start: number) =>
  [0, 1].map(
    () =>
      new Float32Array(BLOCK).map((_, frame) => {
        const at = start + frame;
        const since = at % 12_000;
        return (
          0.5 *
            Math.exp(-since / 2000) *
            Math.sin((2 * Math.PI * 90 * since) / RATE) +
          0.05 * Math.sin((2 * Math.PI * 220 * at) / RATE)
        );
      }) as Float32Array
  );

describe("unlimiterDevice", () => {
  test("plays the processor of @audio/dynamics-unlimit as published, adaptive or not", () => {
    for (const adaptive of [true, false]) {
      const state = { ...defaults, adaptive, guard: true };
      const { processor } = madeProcessor(UNLIMITER_WORKLET, "unlimiter", RATE);
      const parameters = Object.fromEntries(
        Object.entries(unlimiterSettings(state).modelParams).map(
          ([name, value]) => [name, Float32Array.of(value)]
        )
      );
      const values = {
        ...Object.fromEntries(
          Object.entries(unlimit.params).map(([name, param]) => [
            name,
            Float32Array.of(Number(param.default)),
          ])
        ),
        ...parameters,
        adaptive,
      };
      const run = unlimit({
        currentTime: 0,
        maxBlockSize: BLOCK,
        maxChannels: 2,
        params: values,
        sampleRate: RATE,
      });
      let worst = 0;
      for (let block = 0; block < 300; block += 1) {
        const input = hits(block * BLOCK);
        const expected = new Float32Array(BLOCK);
        run([input], [[expected, new Float32Array(BLOCK)]], values);
        const out = new Float32Array(BLOCK);
        processor.process(
          [input],
          [[out, new Float32Array(BLOCK)]],
          parameters
        );
        for (let frame = 0; frame < BLOCK; frame += 1) {
          worst = Math.max(
            worst,
            Math.abs((out[frame] ?? 0) - (expected[frame] ?? 0))
          );
        }
      }
      expect({ adaptive, worst }).toEqual({ adaptive, worst: 0 });
    }
  });

  test("with no guard, the ceiling is the manifest's own, where no peak reaches", () => {
    expect(unlimiterSettings(defaults).modelParams.ceiling).toBe(
      unlimit.params.ceiling.default
    );
    expect(
      unlimiterSettings({ ...defaults, guard: true }).modelParams.ceiling
    ).toBe(-1);
    expect(unlimiterUnused(defaults)).toEqual(["ceilingDb"]);
    expect(
      unlimiterUnused({ ...defaults, adaptive: false, guard: true })
    ).toEqual(["crestDb"]);
  });

  test("its lift is the package's own: adaptive, an attack at the crest gets none", () => {
    const lift = unlimiterLift(defaults);
    expect(lift(5)).toBe(unlimitDeficitGain(5, 10, 6, 1));
    expect(lift(10)).toBe(0);
    const proportional = unlimiterLift({ ...defaults, adaptive: false });
    expect(proportional(20)).toBe(unlimitGain(20, 0, 6, 1));
    expect(unlimiterLift({ ...defaults, enabled: false })(5)).toBe(0);
  });
});
