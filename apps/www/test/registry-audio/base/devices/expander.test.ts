import { describe, expect, test } from "bun:test";
import { expanderGain, upwardExpanderGain } from "@audio/dynamics-expander";
import { expander } from "@audio/dynamics-expander/audio";
import {
  EXPANDER_WORKLET,
  expanderCurve,
  expanderDevice,
  expanderSettings,
} from "@/registry-audio/bases/base/devices/expander/device";
import { madeProcessor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = expanderDevice.defaults();

/** A tone that swells and fades, through the threshold both ways. */
const swell = (start: number) =>
  [0, 1].map(
    () =>
      new Float32Array(BLOCK).map((_, frame) => {
        const at = start + frame;
        const level = 10 ** ((-60 + 50 * Math.abs(Math.sin(at / 20_000))) / 20);
        return level * Math.sin((2 * Math.PI * 220 * at) / RATE);
      }) as Float32Array
  );

describe("expanderDevice", () => {
  test("is a stable, named effect", () => {
    expect(expanderDevice.id).toBe("audioui.expander");
    expect(
      expanderDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "mode",
      "thresholdDb",
      "ratio",
      "kneeDb",
      "rangeDb",
      "attackMs",
      "releaseMs",
    ]);
  });

  test("plays the processor of @audio/dynamics-expander as published, its mode changed as it plays", () => {
    const { processor } = madeProcessor(EXPANDER_WORKLET, "expander", RATE);
    const values = (state: typeof defaults) => {
      const { modelParams } = expanderSettings(state);
      return {
        ...Object.fromEntries(
          Object.entries(modelParams).map(([name, value]) => [
            name,
            Float32Array.of(value),
          ])
        ),
        mode: state.mode,
      };
    };
    const run = expander({
      currentTime: 0,
      maxBlockSize: BLOCK,
      maxChannels: 2,
      params: values(defaults),
      sampleRate: RATE,
    });
    let worst = 0;
    for (let block = 0; block < 400; block += 1) {
      const state =
        block < 200 ? defaults : { ...defaults, mode: "upward" as const };
      const input = swell(block * BLOCK);
      const expected = new Float32Array(BLOCK);
      run([input], [[expected, new Float32Array(BLOCK)]], values(state));
      const out = new Float32Array(BLOCK);
      const parameters = Object.fromEntries(
        Object.entries(expanderSettings(state).modelParams).map(
          ([name, value]) => [name, Float32Array.of(value)]
        )
      );
      processor.process([input], [[out, new Float32Array(BLOCK)]], parameters);
      for (let frame = 0; frame < BLOCK; frame += 1) {
        worst = Math.max(
          worst,
          Math.abs((out[frame] ?? 0) - (expected[frame] ?? 0))
        );
      }
    }
    expect(worst).toBe(0);
  });

  test("its curve is the package's own, the range a floor downward and a ceiling upward", () => {
    const curve = expanderCurve(defaults);
    for (const inputDb of [-80, -50, -32, -30, -10]) {
      expect(curve(inputDb)).toBe(
        inputDb + expanderGain(inputDb, -30, 2, 6, -40)
      );
    }
    expect(curve(-80)).toBe(-120);
    const up = expanderCurve({ ...defaults, mode: "upward", rangeDb: 12 });
    expect(up(-10)).toBe(-10 + upwardExpanderGain(-10, -30, 2, 6, 12));
    expect(up(0)).toBe(12);
    expect(expanderCurve({ ...defaults, enabled: false })(-50)).toBe(-50);
  });

  test("the mode goes to the worklet by its index, and off it plays nothing", () => {
    expect(
      expanderSettings({ ...defaults, mode: "upward" }).modelParams.mode
    ).toBe(1);
    expect(expanderSettings(defaults).modelParams.mode).toBe(0);
    expect(expanderSettings({ ...defaults, enabled: false }).wet).toBe(0);
  });
});
