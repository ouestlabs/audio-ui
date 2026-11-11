import { describe, expect, test } from "bun:test";
import {
  compressorCurve,
  compressorDevice,
  compressorSettings,
} from "@/registry-audio/bases/base/devices/compressor/device";

const defaults = compressorDevice.defaults();

describe("compressorDevice", () => {
  test("is a stable, named effect", () => {
    expect(compressorDevice.id).toBe("audioui.compressor");
    expect(compressorDevice.kind).toBe("effect");
    expect(
      compressorDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "model",
      "thresholdDb",
      "ratio",
      "attackMs",
      "releaseMs",
      "kneeDb",
      "makeupDb",
      "mix",
    ]);
  });

  test("keeps every range inside what the models accept", () => {
    // The models take a ratio of 1 to 20, a knee of 0 to 40 and a threshold of -100 to 0.
    const range = (id: string) => {
      const found = compressorDevice
        .describe()
        .parameters.find((parameter) => parameter.id === id);
      return [found?.min, found?.max];
    };
    expect(range("ratio")).toEqual([1, 20]);
    expect(range("kneeDb")).toEqual([0, 40]);
    const [lowest, highest] = range("thresholdDb");
    expect(lowest).toBeGreaterThanOrEqual(-100);
    expect(highest).toBeLessThanOrEqual(0);
  });

  test("prints the ratio as a ratio", () => {
    expect(compressorDevice.format("ratio", 4)).toBe("4.0:1");
    expect(compressorDevice.format("attackMs", 5)).toBe("5.0 ms");
  });
});

describe("compressorSettings", () => {
  test("hands the model its values in its manifest's units, and a percent is a mix", () => {
    const settings = compressorSettings({
      ...defaults,
      attackMs: 5,
      kneeDb: 12,
      mix: 40,
      ratio: 8,
      releaseMs: 250,
      thresholdDb: -30,
    });
    expect(settings.modelParams).toEqual({
      attack: 5,
      knee: 12,
      ratio: 8,
      release: 250,
      threshold: -30,
    });
    expect(settings.wet).toBeCloseTo(0.4, 12);
    expect(settings.dry).toBeCloseTo(0.6, 12);
  });

  test("the make-up knob goes on after the model", () => {
    expect(compressorSettings({ ...defaults, makeupDb: 9 }).modelTrimDb).toBe(
      9
    );
  });

  test("bypassed is all dry", () => {
    const settings = compressorSettings({
      ...defaults,
      enabled: false,
      mix: 100,
    });
    expect([settings.dry, settings.wet]).toEqual([1, 0]);
  });

  test("a mix of nothing is all dry and of everything all compressed", () => {
    expect(compressorSettings({ ...defaults, mix: 0 })).toMatchObject({
      dry: 1,
      wet: 0,
    });
    expect(compressorSettings({ ...defaults, mix: 100 })).toMatchObject({
      dry: 0,
      wet: 1,
    });
  });
});

describe("compressorCurve", () => {
  test("is the input itself below the threshold, with no make-up", () => {
    const state = { ...defaults, makeupDb: 0 };
    for (const level of [-60, -40, -30]) {
      expect(compressorCurve(state)(level)).toBeCloseTo(level, 1);
    }
  });

  test("adds the make-up asked for", () => {
    const state = { ...defaults, makeupDb: 6 };
    expect(compressorCurve(state)(-60)).toBeCloseTo(-54, 1);
  });

  test("is the identity when bypassed or fully dry", () => {
    for (const state of [
      { ...defaults, enabled: false },
      { ...defaults, mix: 0 },
    ]) {
      for (const level of [-60, -18, 0]) {
        expect(compressorCurve(state)(level)).toBeCloseTo(level, 9);
      }
    }
  });

  test("brings loud levels down, more with a higher ratio", () => {
    const base = { ...defaults, makeupDb: 0 };
    const gentle = compressorCurve({ ...base, ratio: 2 })(0);
    const hard = compressorCurve({ ...base, ratio: 10 })(0);
    expect(gentle).toBeLessThan(0);
    expect(hard).toBeLessThan(gentle);
  });

  test("a parallel mix sits between the dry and the compressed curve", () => {
    const base = { ...defaults, makeupDb: 0 };
    const dry = compressorCurve({ ...base, mix: 0 })(0);
    const wet = compressorCurve({ ...base, mix: 100 })(0);
    const half = compressorCurve({ ...base, mix: 50 })(0);
    expect(half).toBeLessThan(dry);
    expect(half).toBeGreaterThan(wet);
  });
});
