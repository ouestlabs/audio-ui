import { describe, expect, test } from "bun:test";
import { compressorGain } from "@audio/dynamics-compressor";
import { ducker } from "@audio/dynamics-ducker/audio";
import {
  DUCKER_WORKLET,
  duckerCurve,
  duckerDevice,
  duckerSettings,
} from "@/registry-audio/bases/base/devices/ducker/device";
import { madeProcessor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = duckerDevice.defaults();

const tone = (start: number, hz: number, amplitude: number) =>
  new Float32Array(BLOCK).map(
    (_, frame) =>
      amplitude * Math.sin((2 * Math.PI * hz * (start + frame)) / RATE)
  );

/** A key that comes and goes: a kick-like burst every 250 ms. */
const key = (start: number) =>
  new Float32Array(BLOCK).map((_, frame) => {
    const at = start + frame;
    return (
      Math.exp(-(at % 12_000) / 1500) * Math.sin((2 * Math.PI * 60 * at) / RATE)
    );
  });

describe("duckerDevice", () => {
  test("is a stable, named effect that takes a sidechain", () => {
    expect(duckerDevice.id).toBe("audioui.ducker");
    expect(duckerDevice.describe().sidechain).toBe(true);
    expect(
      duckerDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "thresholdDb",
      "ratio",
      "kneeDb",
      "rangeDb",
      "attackMs",
      "releaseMs",
    ]);
  });

  test("plays the processor of @audio/dynamics-ducker as published: the sound on its first input, the key on its second", () => {
    const { processor } = madeProcessor(DUCKER_WORKLET, "ducker", RATE);
    const parameters = Object.fromEntries(
      Object.entries(duckerSettings(defaults).modelParams).map(
        ([name, value]) => [name, Float32Array.of(value)]
      )
    );
    const run = ducker({
      currentTime: 0,
      maxBlockSize: BLOCK,
      maxChannels: 2,
      params: parameters,
      sampleRate: RATE,
    });
    let worst = 0;
    let ducked = 0;
    for (let block = 0; block < 200; block += 1) {
      const sound = tone(block * BLOCK, 440, 0.3);
      const keyed = key(block * BLOCK);
      const expected = new Float32Array(BLOCK);
      run(
        [
          [sound, sound],
          [keyed, keyed],
        ],
        [[expected, new Float32Array(BLOCK)]],
        parameters
      );
      const out = new Float32Array(BLOCK);
      processor.process(
        [
          [sound, sound],
          [keyed, keyed],
        ],
        [[out, new Float32Array(BLOCK)]],
        parameters
      );
      for (let frame = 0; frame < BLOCK; frame += 1) {
        worst = Math.max(
          worst,
          Math.abs((out[frame] ?? 0) - (expected[frame] ?? 0))
        );
        ducked = Math.max(
          ducked,
          Math.abs(sound[frame] ?? 0) - Math.abs(out[frame] ?? 0)
        );
      }
    }
    expect(worst).toBe(0);
    expect(ducked).toBeGreaterThan(0.1);
  });

  test("with nothing on the sidechain, it follows the sound itself", () => {
    const { processor } = madeProcessor(DUCKER_WORKLET, "ducker", RATE);
    const parameters = Object.fromEntries(
      Object.entries(duckerSettings(defaults).modelParams).map(
        ([name, value]) => [name, Float32Array.of(value)]
      )
    );
    let loudest = 0;
    for (let block = 0; block < 400; block += 1) {
      const sound = tone(block * BLOCK, 440, 0.5);
      const out = new Float32Array(BLOCK);
      processor.process(
        [[sound, sound], []],
        [[out, new Float32Array(BLOCK)]],
        parameters
      );
      if (block > 300) {
        loudest = Math.max(loudest, ...out.map(Math.abs));
      }
    }
    expect(loudest).toBeLessThan(0.3);
  });

  test("its curve is the package's compression, held within the range", () => {
    const curve = duckerCurve(defaults);
    expect(curve(-50)).toBe(0);
    expect(curve(-10)).toBe(compressorGain(-10, -30, 4, 6));
    expect(curve(20)).toBe(-24);
    expect(duckerCurve({ ...defaults, enabled: false })(0)).toBe(0);
    expect(duckerSettings(defaults).modelParams.range).toBe(-24);
  });
});
