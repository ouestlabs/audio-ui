import { describe, expect, test } from "bun:test";
import frequencyShifter from "@audio/effect-freqshift";
import ringMod from "@audio/effect-ringmod";
import {
  FREQUENCY_SHIFTER_WORKLET,
  frequencyShifterDevice,
  frequencyShifterPartials,
  frequencyShifterSettings,
} from "@/registry-audio/bases/base/devices/frequency-shifter/device";
import { createFrequencyShifterEngine } from "@/registry-audio/bases/base/devices/frequency-shifter/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = frequencyShifterDevice.defaults();

describe("the frequency shifter device", () => {
  test("a shift moves each harmonic by the same hertz, one below 0 coming back as its mirror", () => {
    expect(
      frequencyShifterPartials({ ...defaults, shiftHz: 100 }, 220, 3).output
    ).toEqual([320, 540, 760]);
    expect(
      frequencyShifterPartials({ ...defaults, shiftHz: -300 }, 220, 2).output
    ).toEqual([80, 140]);
  });

  test("a ring leaves the sum and the difference, each once", () => {
    expect(
      frequencyShifterPartials(
        { ...defaults, frequencyHz: 330, mode: "ring" },
        220,
        2
      ).output
    ).toEqual([110, 550, 770]);
  });

  test("the shift's latency is half its filter, the ring has none", () => {
    expect(frequencyShifterDevice.latency(defaults, RATE)).toBeCloseTo(
      32 / RATE,
      12
    );
    expect(
      frequencyShifterDevice.latency({ ...defaults, precision: "high" }, RATE)
    ).toBeCloseTo(127 / RATE, 12);
    expect(
      frequencyShifterDevice.latency({ ...defaults, mode: "ring" }, RATE)
    ).toBe(0);
  });

  test("off, nothing is mixed in", () => {
    expect(frequencyShifterSettings({ ...defaults, enabled: false }).mix).toBe(
      0
    );
  });
});

describe("the frequency shifter's worklet", () => {
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
      FREQUENCY_SHIFTER_WORKLET
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
  const parametersOf = (taps: number) => ({
    frequency: new Float32Array([330]),
    mix: new Float32Array([0.7]),
    shift: new Float32Array([-150]),
    taps: new Float32Array([taps]),
  });
  const sine = (start: number) =>
    new Float32Array(BLOCK).map((_, frame) =>
      Math.sin((2 * Math.PI * 440 * (start + frame)) / RATE)
    );

  test("plays the package's shifter and ring modulator, one output each", () => {
    const processor = made();
    const parameters = parametersOf(65);
    const [mix] = parameters.mix;
    const shifter = { fs: RATE, mix, shift: parameters.shift[0], taps: 65 };
    const ring = { fc: parameters.frequency[0], fs: RATE, mix };
    for (let block = 0; block < 6; block += 1) {
      const input = sine(block * BLOCK);
      const outputs = [0, 1].map(() => [
        new Float32Array(BLOCK),
        new Float32Array(BLOCK),
      ]);
      processor.process([[input]], outputs, parameters);
      const shifted = frequencyShifter(Float32Array.from(input), shifter);
      const ringed = ringMod(Float32Array.from(input), ring);
      expect([...(outputs[0]?.[0] ?? [])]).toEqual([...shifted]);
      expect([...(outputs[0]?.[1] ?? [])]).toEqual([...shifted]);
      expect([...(outputs[1]?.[0] ?? [])]).toEqual([...ringed]);
    }
  });

  test("new taps wait for the choice to rest, then a fresh shifter of that length takes over", () => {
    const processor = made();
    const [mix] = parametersOf(65).mix;
    const [shift] = parametersOf(65).shift;
    const old = { fs: RATE, mix, shift, taps: 65 };
    let fresh: Record<string, unknown> | undefined;
    const rest = Math.ceil((0.12 * RATE) / BLOCK);
    const fade = Math.ceil((0.08 * RATE) / BLOCK);
    for (let block = 0; block < 10 + rest + fade + 4; block += 1) {
      const input = sine(block * BLOCK);
      const outputs = [0, 1].map(() => [
        new Float32Array(BLOCK),
        new Float32Array(BLOCK),
      ]);
      processor.process(
        [[input]],
        outputs,
        parametersOf(block >= 10 ? 255 : 65)
      );
      if (block === 10 + rest) {
        fresh = { fs: RATE, mix, shift, taps: 255 };
      }
      const playing = frequencyShifter(Float32Array.from(input), old);
      const coming = fresh
        ? frequencyShifter(Float32Array.from(input), fresh)
        : undefined;
      if (block < 10 + rest) {
        expect([...(outputs[0]?.[0] ?? [])]).toEqual([...playing]);
      } else if (block > 10 + rest + fade && coming) {
        expect([...(outputs[0]?.[0] ?? [])]).toEqual([...coming]);
      }
    }
    expect(fresh).toBeDefined();
  });
});

describe("createFrequencyShifterEngine", () => {
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
    const engine = createFrequencyShifterEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    // Input, output, clean, then a gain per mode.
    expect(gains[2]?.gain.value).toBe(1);
    expect(gains[3]?.gain.value).toBe(0);
    expect(gains[4]?.gain.value).toBe(0);
  });
});
