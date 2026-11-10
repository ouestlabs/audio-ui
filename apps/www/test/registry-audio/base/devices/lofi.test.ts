import { describe, expect, test } from "bun:test";
import lofi from "@audio/effect-lofi";
import {
  LOFI_WORKLET,
  lofiCurve,
  lofiDevice,
  lofiSettings,
} from "@/registry-audio/bases/base/devices/lofi/device";
import { createLofiEngine } from "@/registry-audio/bases/base/devices/lofi/engine";

const defaults = lofiDevice.defaults();
const RATE = 48_000;

/** The gain of a response at a frequency, in dB. */
function gainAt(response: Float32Array, hz: number) {
  let re = 0;
  let im = 0;
  for (const [frame, sample] of response.entries()) {
    re += sample * Math.cos((2 * Math.PI * hz * frame) / RATE);
    im -= sample * Math.sin((2 * Math.PI * hz * frame) / RATE);
  }
  return 20 * Math.log10(Math.hypot(re, im));
}

describe("the lo-fi device", () => {
  test("its wow, flutter, hiss, crackle, band and drive start where the kernel does", () => {
    expect(lofiSettings(defaults)).toMatchObject({
      crackle: 0.1,
      drive: 0.3,
      flutter: 0.2,
      highpass: 60,
      lowpass: 6000,
      noise: 0.1,
      wow: 0.3,
    });
  });

  test("off, the sound goes round it, clean", () => {
    expect(lofiSettings({ ...defaults, enabled: false })).toMatchObject({
      dry: 1,
      wet: 0,
    });
    expect(lofiCurve({ ...defaults, enabled: false })(100)).toBe(0);
  });

  test("the band it draws is the kernel's own, its filters alone", () => {
    const state = { ...defaults, highpassHz: 120, lowpassHz: 3000 };
    const click = new Float32Array(16_384);
    click[0] = 1;
    // No drift, wobble, hiss, crackle or drive: the kernel is its filters, and a short delay.
    const response = lofi(click, {
      crackle: 0,
      drive: 0,
      flutter: 0,
      fs: RATE,
      highpass: 120,
      lowpass: 3000,
      noise: 0,
      wow: 0,
    });
    const curve = lofiCurve(state);
    for (const hz of [40, 120, 1000, 3000, 8000]) {
      expect(curve(hz)).toBeCloseTo(gainAt(response, hz), 1);
    }
  });

  test("the highs fall away above the low-pass, three poles deep, and the lows under the high-pass", () => {
    const curve = lofiCurve({ ...defaults, highpassHz: 200, lowpassHz: 500 });
    expect(curve(8000) - curve(4000)).toBeLessThan(-14);
    expect(curve(20)).toBeLessThan(-15);
  });
});

describe("the lo-fi's worklet", () => {
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
      LOFI_WORKLET
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
  const settings = lofiSettings(defaults);
  const parameters = Object.fromEntries(
    (
      [
        "wow",
        "flutter",
        "noise",
        "crackle",
        "lowpass",
        "highpass",
        "drive",
      ] as const
    ).map((name) => [name, new Float32Array([settings[name]])])
  );
  const sine = () =>
    new Float32Array(128).map((_, frame) =>
      Math.sin((2 * Math.PI * 440 * frame) / RATE)
    );

  test("plays the package's lo-fi, each channel with a noise of its own", () => {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    made().process([[sine(), sine()]], [[left, right]], parameters);
    const expected = (channel: number) =>
      lofi(sine(), {
        ...Object.fromEntries(
          Object.entries(parameters).map(([name, value]) => [name, value[0]])
        ),
        fs: RATE,
        seed: (0x25_45_f4_91 ^ (channel * 0x9e_37_79_b9)) >>> 0,
      });
    expect([...left]).toEqual([...expected(0)]);
    expect([...right]).toEqual([...expected(1)]);
    expect([...left]).not.toEqual([...right]);
  });

  test("with nothing coming in, its hiss plays on", () => {
    const processor = made();
    processor.process([[sine()]], [[new Float32Array(128)]], parameters);
    const output = new Float32Array(128);
    processor.process([[]], [[output]], parameters);
    expect(Math.max(...output.map(Math.abs))).toBeGreaterThan(1e-4);
  });
});

describe("createLofiEngine", () => {
  test("a context with no worklets lets the sound through clean, and says so", async () => {
    const gains: { gain: { value: number } }[] = [];
    const node = () => ({
      connect: <T>(destination: T) => destination,
      disconnect: () => undefined,
    });
    const ctx = {
      createGain: () => {
        const gain = {
          ...node(),
          gain: { setTargetAtTime: () => undefined, value: 0 },
        };
        gains.push(gain);
        return gain;
      },
      currentTime: 0,
    } as unknown as BaseAudioContext;
    const engine = createLofiEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    // Input, output, wet, dry: the wet silent, the dry open.
    expect(gains[2]?.gain.value).toBe(0);
    expect(gains[3]?.gain.value).toBe(1);
  });
});
