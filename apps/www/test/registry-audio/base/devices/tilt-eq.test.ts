import { describe, expect, test } from "bun:test";
import tilt from "@audio/eq-tilt";
import {
  TILT_EQ_WORKLET,
  tiltEqCurve,
  tiltEqDevice,
  tiltEqSettings,
} from "@/registry-audio/bases/base/devices/tilt-eq/device";
import { createTiltEqEngine } from "@/registry-audio/bases/base/devices/tilt-eq/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = tiltEqDevice.defaults();

/** The gain of a response at a frequency, in dB. */
function gainAt(response: Float64Array, hz: number) {
  let re = 0;
  let im = 0;
  for (const [frame, sample] of response.entries()) {
    re += sample * Math.cos((2 * Math.PI * hz * frame) / RATE);
    im -= sample * Math.sin((2 * Math.PI * hz * frame) / RATE);
  }
  return 20 * Math.log10(Math.hypot(re, im));
}

describe("the tilt EQ device", () => {
  test("its curve is the package's tilt, the other way round", () => {
    const state = { ...defaults, pivotHz: 700, tiltDb: 6 };
    const click = new Float64Array(16_384);
    click[0] = 1;
    const response = tilt(click, { fs: RATE, gain: -6, pivot: 700 });
    const curve = tiltEqCurve(state);
    for (const hz of [30, 200, 700, 2000, 12_000]) {
      expect(curve(hz)).toBeCloseTo(gainAt(response, hz), 1);
    }
  });

  test("up raises the highs and lowers the lows by as much, the pivot where it was", () => {
    const curve = tiltEqCurve({ ...defaults, tiltDb: 6 });
    expect(curve(20_000)).toBeGreaterThan(5);
    expect(curve(20)).toBeLessThan(-5);
    expect(curve(1000)).toBeCloseTo(0, 6);
    expect(curve(20_000) + curve(20)).toBeCloseTo(0, 0);
  });

  test("off, it is flat and the output at unity", () => {
    const off = { ...defaults, enabled: false, outputDb: 6, tiltDb: 9 };
    expect(tiltEqCurve(off)(100)).toBe(0);
    expect(tiltEqSettings(off)).toMatchObject({ gain: 0, output: 1 });
  });
});

describe("the tilt EQ's worklet", () => {
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
      TILT_EQ_WORKLET
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

  test("plays the package's tilt per channel, its filters kept from block to block", () => {
    const processor = made();
    const parameters = {
      gain: new Float32Array([-4]),
      pivot: new Float32Array([1500]),
    };
    const reference = {
      fs: RATE,
      gain: parameters.gain[0],
      pivot: parameters.pivot[0],
    };
    for (let block = 0; block < 8; block += 1) {
      const input = new Float32Array(BLOCK).map((_, frame) =>
        Math.sin((2 * Math.PI * 220 * (block * BLOCK + frame)) / RATE)
      );
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      processor.process([[input]], [[left, right]], parameters);
      const expected = tilt(Float32Array.from(input), reference);
      expect([...left]).toEqual([...expected]);
      expect([...right]).toEqual([...expected]);
    }
  });
});

describe("createTiltEqEngine", () => {
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
    const engine = createTiltEqEngine(ctx, { ...defaults, tiltDb: 6 });
    expect(await engine.ready).toBe(false);
    // Input, output, tilted, clean, level.
    expect(gains[2]?.gain.value).toBe(0);
    expect(gains[3]?.gain.value).toBe(1);
  });
});
