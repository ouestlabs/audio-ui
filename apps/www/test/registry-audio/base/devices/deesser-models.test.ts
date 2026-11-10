import { describe, expect, test } from "bun:test";
import { latency } from "@audio/dynamics-deesser";
import { deesser } from "@audio/dynamics-deesser/audio";
import {
  DEESSER_WORKLET,
  deesserDevice,
  deesserResponse,
  deesserSettings,
  deesserUnused,
} from "@/registry-audio/bases/base/devices/deesser/device";
import { madeProcessor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = deesserDevice.defaults();
const MODES = ["split", "band", "broadband"] as const;

/** A voice-like body at 300 Hz with an "s" of noise in bursts: what a de-esser hears. */
function voice(start: number) {
  let seed = start + 1;
  const noise = () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return (seed / 2_147_483_647) * 2 - 1;
  };
  return [0, 1].map(
    () =>
      new Float32Array(BLOCK).map((_, frame) => {
        const at = start + frame;
        const ess = Math.floor(at / 6000) % 2 === 1 ? 0.4 * noise() : 0;
        return 0.3 * Math.sin((2 * Math.PI * 300 * at) / RATE) + ess;
      }) as Float32Array
  );
}

/** The manifest's values for a state, a choice as its value, as the worklet hands them on. */
function valuesOf(state: typeof defaults) {
  const { modelParams } = deesserSettings(state);
  return Object.fromEntries(
    Object.entries(deesser.params).map(([name, param]) => {
      if (name === "mode") {
        return [name, deesser.params.mode.values[modelParams.mode]];
      }
      const set = modelParams[name as keyof typeof modelParams];
      return [name, Float32Array.of(set ?? Number(param.default))];
    })
  );
}

describe("the de-esser's models", () => {
  test("each plays the processor of @audio/dynamics-deesser in its mode, sample for sample", () => {
    for (const model of MODES) {
      const state = { ...defaults, model, overBodyDb: -6 };
      const { processor } = madeProcessor(DEESSER_WORKLET, "deesser", RATE);
      const parameters = Object.fromEntries(
        Object.entries(deesserSettings(state).modelParams).map(
          ([name, value]) => [name, Float32Array.of(value)]
        )
      );
      const values = valuesOf(state);
      const run = deesser({
        currentTime: 0,
        maxBlockSize: BLOCK,
        maxChannels: 2,
        params: values,
        sampleRate: RATE,
      });
      let worst = 0;
      let cut = 0;
      for (let block = 0; block < 200; block += 1) {
        const input = voice(block * BLOCK);
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
          cut += Math.abs(out[frame] ?? 0);
        }
      }
      expect({ model, worst }).toEqual({ model, worst: 0 });
      expect(cut).toBeGreaterThan(0);
    }
  });

  test("the mode goes by its index, the range as a cut, the frequency as the split and the band's centre", () => {
    const settings = deesserSettings({
      ...defaults,
      frequencyHz: 7000,
      model: "band",
      q: 2,
      rangeDb: 10,
    });
    expect(settings.modelParams).toMatchObject({
      fc: 7000,
      mode: 1,
      Q: 2,
      range: -10,
      split: 7000,
    });
    expect(settings.modelWet).toBe(1);
    expect(deesserSettings(defaults).modelWet).toBe(0);
    // Listen is the clean model's: the others never mute the lows.
    expect(
      deesserSettings({ ...defaults, listen: true, model: "split" }).lowGain
    ).toBe(1);
  });

  test("each model draws off what it does not use, and only the others look ahead", () => {
    expect(deesserUnused("clean")).toEqual(["q", "overBodyDb"]);
    expect(deesserUnused("band")).toEqual(["thresholdDb", "listen"]);
    expect(deesserUnused("broadband")).toEqual(["thresholdDb", "listen", "q"]);
    expect(deesserDevice.latency(defaults, RATE)).toBe(0);
    expect(deesserDevice.latency({ ...defaults, model: "split" }, RATE)).toBe(
      latency(RATE) / RATE
    );
  });

  test("the panel draws the cut of each model: the highs, a band, or everything", () => {
    const at = (model: (typeof MODES)[number], hz: number) =>
      deesserResponse({ ...defaults, model, rangeDb: 12 })(hz);
    expect(at("split", 500)).toBeCloseTo(0, 1);
    expect(at("split", 18_000)).toBeCloseTo(-12, 0);
    expect(at("band", 6500)).toBeCloseTo(-12, 6);
    expect(at("band", 500)).toBeGreaterThan(-1);
    expect(at("broadband", 500)).toBeCloseTo(-12, 9);
  });
});
