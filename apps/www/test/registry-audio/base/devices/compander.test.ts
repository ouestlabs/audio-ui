import { describe, expect, test } from "bun:test";
import { compand } from "@audio/dynamics-compand/audio";
import {
  COMPANDER_WORKLET,
  companderCurve,
  companderDevice,
  companderSettings,
} from "@/registry-audio/bases/base/devices/compander/device";
import { madeProcessor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = companderDevice.defaults();

const swell = (start: number) =>
  [0, 1].map(
    () =>
      new Float32Array(BLOCK).map((_, frame) => {
        const at = start + frame;
        const level = 10 ** ((-70 + 68 * Math.abs(Math.sin(at / 20_000))) / 20);
        return level * Math.sin((2 * Math.PI * 330 * at) / RATE);
      }) as Float32Array
  );

describe("companderDevice", () => {
  test("is a stable, named effect with a point at each of the manifest's levels in", () => {
    expect(companderDevice.id).toBe("audioui.compander");
    expect(
      companderDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "out0Db",
      "out1Db",
      "out2Db",
      "out3Db",
      "attackMs",
      "releaseMs",
    ]);
    expect(
      Object.keys(compand.params).filter((name) => name.startsWith("out"))
    ).toEqual(["out0", "out1", "out2", "out3"]);
  });

  test("plays the processor of @audio/dynamics-compand as published", () => {
    const state = { ...defaults, out1Db: -45, out3Db: -12 };
    const { processor } = madeProcessor(COMPANDER_WORKLET, "compander", RATE);
    const parameters = Object.fromEntries(
      Object.entries(companderSettings(state).modelParams).map(
        ([name, value]) => [name, Float32Array.of(value)]
      )
    );
    const run = compand({
      currentTime: 0,
      maxBlockSize: BLOCK,
      maxChannels: 2,
      params: parameters,
      sampleRate: RATE,
    });
    let worst = 0;
    for (let block = 0; block < 300; block += 1) {
      const input = swell(block * BLOCK);
      const expected = new Float32Array(BLOCK);
      run([input], [[expected, new Float32Array(BLOCK)]], parameters);
      const out = new Float32Array(BLOCK);
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

  test("its curve goes through its points, in straight lines between them", () => {
    const curve = companderCurve({ ...defaults, out1Db: -40, out3Db: -10 });
    expect(curve(-60)).toBeCloseTo(-40, 1);
    expect(curve(-20)).toBeCloseTo(-20, 1);
    expect(curve(0)).toBeCloseTo(-10, 1);
    expect(curve(-10)).toBeCloseTo(-15, 1);
    expect(curve(-40)).toBeCloseTo(-30, 1);
    expect(companderCurve({ ...defaults, enabled: false })(-30)).toBe(-30);
  });
});
