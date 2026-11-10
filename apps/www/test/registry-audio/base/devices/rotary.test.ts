import { describe, expect, test } from "bun:test";
import rotary from "@audio/effect-rotary";
import {
  ROTARY_WORKLET,
  rotaryBands,
  rotaryDevice,
  rotarySettings,
} from "@/registry-audio/bases/base/devices/rotary/device";
import { createRotaryEngine } from "@/registry-audio/bases/base/devices/rotary/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = rotaryDevice.defaults();

describe("the rotary device", () => {
  test("its speeds are the classic cabinet's, and stopped is still", () => {
    expect(rotarySettings(defaults)).toMatchObject({
      drumSpeed: 0.7,
      hornSpeed: 0.8,
    });
    expect(rotarySettings({ ...defaults, speed: "fast" })).toMatchObject({
      drumSpeed: 5.9,
      hornSpeed: 6.7,
    });
    expect(rotarySettings({ ...defaults, speed: "stop" })).toMatchObject({
      drumSpeed: 0,
      hornSpeed: 0,
    });
  });

  test("its two bands meet 6 dB down at the crossover and sum back to flat", () => {
    const bands = rotaryBands({ ...defaults, crossoverHz: 800 });
    expect(bands.drum(800)).toBeCloseTo(-6.02, 2);
    expect(bands.horn(800)).toBeCloseTo(-6.02, 2);
    for (const hz of [100, 800, 5000]) {
      expect(
        10 ** (bands.drum(hz) / 20) + 10 ** (bands.horn(hz) / 20)
      ).toBeCloseTo(1, 6);
    }
  });

  test("off, nothing is mixed in, and the width is in radians", () => {
    expect(rotarySettings({ ...defaults, enabled: false }).mix).toBe(0);
    expect(
      rotarySettings({ ...defaults, widthDeg: 180 }).micSpread
    ).toBeCloseTo(Math.PI, 9);
  });
});

describe("the rotary's worklet", () => {
  interface Processor {
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ) => boolean;
  }
  const made = () => {
    class AudioWorkletProcessor {}
    let Made: (new () => Processor) | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      "sampleRate",
      ROTARY_WORKLET
    )(
      AudioWorkletProcessor,
      (_name: string, processor: new () => Processor) => {
        Made = processor;
      },
      RATE
    );
    if (!Made) {
      throw new Error("The worklet registered no processor");
    }
    return new Made();
  };

  test("plays the package's rotary, its vendored crossover and sections the package's own", () => {
    const parameters = Object.fromEntries(
      Object.entries(rotarySettings({ ...defaults, speed: "fast" })).map(
        ([name, value]) => [name, new Float32Array([value])]
      )
    );
    const reference: Record<string, number> = { fs: RATE };
    for (const [name, [value]] of Object.entries(parameters)) {
      reference[name] = value ?? 0;
    }
    const processor = made();
    for (let block = 0; block < 20; block += 1) {
      const input = new Float32Array(BLOCK).map((_, frame) =>
        Math.sin((2 * Math.PI * 440 * (block * BLOCK + frame)) / RATE)
      );
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      processor.process([[input]], [[left, right]], parameters);
      const [expectedLeft, expectedRight] = rotary(
        Float32Array.from(input),
        Float32Array.from(input),
        reference
      );
      expect([...left]).toEqual([...(expectedLeft ?? [])]);
      expect([...right]).toEqual([...(expectedRight ?? [])]);
    }
  });
});

describe("createRotaryEngine", () => {
  test("a context with no worklets lets the sound through clean, and says so", async () => {
    const gains: { gain: { value: number } }[] = [];
    const ctx = {
      createGain: () => {
        const gain = {
          connect: <T>(to: T) => to,
          disconnect: () => undefined,
          gain: { setTargetAtTime: () => undefined, value: 0 },
        };
        gains.push(gain);
        return gain;
      },
      currentTime: 0,
    } as unknown as BaseAudioContext;
    const engine = createRotaryEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    expect(gains[2]?.gain.value).toBe(0);
    expect(gains[3]?.gain.value).toBe(1);
  });
});
