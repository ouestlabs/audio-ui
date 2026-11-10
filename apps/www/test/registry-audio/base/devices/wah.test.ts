import { describe, expect, test } from "bun:test";
import autoWah from "@audio/effect-autowah";
import wah from "@audio/effect-wah";
import {
  WAH_WORKLET,
  wahCurve,
  wahDevice,
  wahReach,
  wahSettings,
} from "@/registry-audio/bases/base/devices/wah/device";
import { createWahEngine } from "@/registry-audio/bases/base/devices/wah/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = wahDevice.defaults();

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

describe("the wah device", () => {
  test("the curve it draws is the package's band, held at a frequency, mixed with the clean sound", () => {
    for (const mix of [100, 40]) {
      const state = { ...defaults, mix, mode: "pedal" as const, resonance: 8 };
      const click = new Float64Array(16_384);
      click[0] = 1;
      const band = wah(Float64Array.from(click), {
        fc: 900,
        fs: RATE,
        mode: "manual",
        Q: 8,
      });
      const response = click.map(
        (sample, frame) =>
          (1 - mix / 100) * sample + (mix / 100) * (band[frame] ?? 0)
      );
      const curve = wahCurve(state, 900, RATE);
      for (const hz of [100, 500, 900, 1400, 6000]) {
        expect(curve(hz)).toBeCloseTo(gainAt(response, hz), 1);
      }
    }
  });

  test("the band peaks by its resonance where it is", () => {
    const curve = wahCurve({ ...defaults, resonance: 5 }, 1000);
    expect(curve(1000)).toBeCloseTo(20 * Math.log10(5), 2);
    expect(curve(4000)).toBeLessThan(curve(1000) - 12);
  });

  test("its travel: an envelope lifts it by the range, an oscillator sweeps it the depth either side, a pedal holds it", () => {
    const at = { ...defaults, depth: 1, frequencyHz: 500, rangeHz: 2000 };
    expect(wahReach({ ...at, mode: "envelope" })).toEqual({
      high: 2500,
      low: 500,
      rest: 500,
    });
    expect(wahReach({ ...at, mode: "sweep" })).toEqual({
      high: 1000,
      low: 250,
      rest: 500,
    });
    expect(wahReach({ ...at, mode: "pedal" })).toEqual({
      high: 500,
      low: 500,
      rest: 500,
    });
  });

  test("off, the clean sound passes at unity; the mode picks one output", () => {
    expect(
      wahSettings({ ...defaults, enabled: false, outputDb: -6 })
    ).toMatchObject({ dry: 1, output: 1, wet: 0 });
    expect(wahSettings({ ...defaults, mode: "sweep" }).modes).toEqual([
      0, 1, 0,
    ]);
  });
});

describe("the wah's worklet", () => {
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
      WAH_WORKLET
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
  const settings = wahSettings(defaults);
  const parameters = {
    attack: new Float32Array([settings.attack]),
    depth: new Float32Array([settings.depth]),
    frequency: new Float32Array([settings.frequency]),
    q: new Float32Array([settings.q]),
    range: new Float32Array([settings.range]),
    rate: new Float32Array([settings.rate]),
    release: new Float32Array([settings.release]),
    sensitivity: new Float32Array([settings.sensitivity]),
  };
  const at = (name: keyof typeof parameters) => parameters[name][0] ?? 0;

  test("plays the auto-wah, the sweep and the pedal, one output each, as the packages do", () => {
    const processor = made();
    const states = {
      envelope: {
        attack: at("attack"),
        base: at("frequency"),
        fs: RATE,
        Q: at("q"),
        range: at("range"),
        release: at("release"),
        sens: at("sensitivity"),
      },
      pedal: {
        fc: at("frequency"),
        fs: RATE,
        mode: "manual" as const,
        Q: at("q"),
      },
      sweep: {
        depth: at("depth"),
        fc: at("frequency"),
        fs: RATE,
        mode: "auto" as const,
        Q: at("q"),
        rate: at("rate"),
      },
    };
    for (let block = 0; block < 10; block += 1) {
      const input = new Float32Array(BLOCK).map(
        (_, frame) =>
          Math.sin((2 * Math.PI * 330 * (block * BLOCK + frame)) / RATE) *
          (block % 3 === 0 ? 1 : 0.2)
      );
      const outputs = [0, 1, 2].map(() => [
        new Float32Array(BLOCK),
        new Float32Array(BLOCK),
      ]);
      processor.process([[input]], outputs, parameters);
      const expected = [
        autoWah(Float32Array.from(input), states.envelope),
        wah(Float32Array.from(input), states.sweep),
        wah(Float32Array.from(input), states.pedal),
      ];
      for (const [mode, output] of outputs.entries()) {
        expect([...(output[0] ?? [])]).toEqual([...(expected[mode] ?? [])]);
        expect([...(output[1] ?? [])]).toEqual([...(expected[mode] ?? [])]);
      }
    }
  });

  test("with nothing coming in, its bands ring out", () => {
    const processor = made();
    const ring = { ...parameters, q: new Float32Array([20]) };
    const outputs = () =>
      [0, 1, 2].map(() => [new Float32Array(BLOCK), new Float32Array(BLOCK)]);
    const loud = new Float32Array(BLOCK).fill(0.5);
    processor.process([[loud]], outputs(), ring);
    const after = outputs();
    processor.process([[]], after, ring);
    expect(Math.max(...(after[2]?.[0] ?? []).map(Math.abs))).toBeGreaterThan(
      1e-3
    );
  });
});

describe("createWahEngine", () => {
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
    const engine = createWahEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    // Input, output, dry, wet.
    expect(gains[2]?.gain.value).toBe(1);
    expect(gains[3]?.gain.value).toBe(0);
  });
});
