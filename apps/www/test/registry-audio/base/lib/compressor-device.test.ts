import { describe, expect, test } from "bun:test";
import { webAudioCompressorOutput } from "@audio-ui/core/analysis";
import {
  COMPRESSOR_LOOKAHEAD_SECONDS,
  compressorCurve,
  compressorDevice,
  compressorSettings,
  nodeMakeupDb,
} from "@/registry-audio/bases/base/lib/compressor-device";

const defaults = compressorDevice.defaults();

describe("compressorDevice", () => {
  test("is a stable, named effect", () => {
    expect(compressorDevice.id).toBe("audioui.compressor");
    expect(compressorDevice.kind).toBe("effect");
    expect(
      compressorDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "thresholdDb",
      "ratio",
      "attackMs",
      "releaseMs",
      "kneeDb",
      "autoMakeup",
      "makeupDb",
      "mix",
    ]);
  });

  test("keeps every range inside what the node accepts", () => {
    // The node takes a ratio of 1 to 20, a knee of 0 to 40 and a threshold of -100 to 0.
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

describe("nodeMakeupDb", () => {
  test("is what the node adds on its own, as measured in Chrome", () => {
    // -24 dB, 4:1, no knee: +10.8 dB; at 20:1: +13.7 dB.
    expect(nodeMakeupDb({ kneeDb: 0, ratio: 4, thresholdDb: -24 })).toBeCloseTo(
      10.8,
      1
    );
    expect(
      nodeMakeupDb({ kneeDb: 0, ratio: 20, thresholdDb: -24 })
    ).toBeCloseTo(13.7, 1);
  });

  test("is nothing at 1:1", () => {
    expect(nodeMakeupDb({ kneeDb: 0, ratio: 1, thresholdDb: -24 })).toBeCloseTo(
      0,
      6
    );
  });

  test("grows with the threshold going down and the ratio going up", () => {
    const base = nodeMakeupDb({ kneeDb: 6, ratio: 4, thresholdDb: -18 });
    expect(
      nodeMakeupDb({ kneeDb: 6, ratio: 4, thresholdDb: -30 })
    ).toBeGreaterThan(base);
    expect(
      nodeMakeupDb({ kneeDb: 6, ratio: 8, thresholdDb: -18 })
    ).toBeGreaterThan(base);
  });
});

describe("compressorSettings", () => {
  test("turns milliseconds into seconds and a percent into a mix", () => {
    const settings = compressorSettings({
      ...defaults,
      attackMs: 5,
      mix: 40,
      releaseMs: 250,
    });
    expect(settings.attack).toBe(0.005);
    expect(settings.release).toBe(0.25);
    expect(settings.wet).toBeCloseTo(0.4, 12);
    expect(settings.dry).toBeCloseTo(0.6, 12);
  });

  test("with auto make-up it keeps the node's own", () => {
    expect(
      compressorSettings({ ...defaults, autoMakeup: true, makeupDb: 9 }).trimDb
    ).toBe(0);
  });

  test("without it, it takes the node's make-up out and puts the asked one in", () => {
    const state = { ...defaults, autoMakeup: false, makeupDb: 0 };
    expect(compressorSettings(state).trimDb).toBeCloseTo(
      -nodeMakeupDb(state),
      12
    );
    const more = { ...state, makeupDb: 6 };
    expect(compressorSettings(more).trimDb).toBeCloseTo(
      6 - nodeMakeupDb(more),
      12
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

  test("hands the node the values the state holds", () => {
    expect(
      compressorSettings({
        ...defaults,
        kneeDb: 12,
        ratio: 8,
        thresholdDb: -30,
      })
    ).toMatchObject({
      knee: 12,
      ratio: 8,
      threshold: -30,
    });
  });
});

describe("compressorCurve", () => {
  test("is the node's curve when fully compressed", () => {
    const state = { ...defaults, autoMakeup: true, mix: 100 };
    const node = webAudioCompressorOutput({
      kneeDb: 6,
      ratio: 4,
      thresholdDb: -18,
    });
    for (const level of [-60, -30, -18, -6, 0]) {
      expect(compressorCurve(state)(level)).toBeCloseTo(node(level), 9);
    }
  });

  test("is the input itself with no make-up below the threshold", () => {
    const state = { ...defaults, autoMakeup: false, makeupDb: 0 };
    for (const level of [-60, -40, -30]) {
      expect(compressorCurve(state)(level)).toBeCloseTo(level, 9);
    }
  });

  test("adds the make-up asked for", () => {
    const state = { ...defaults, autoMakeup: false, makeupDb: 6 };
    expect(compressorCurve(state)(-60)).toBeCloseTo(-54, 9);
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
    const base = { ...defaults, autoMakeup: false, makeupDb: 0 };
    const gentle = compressorCurve({ ...base, ratio: 2 })(0);
    const hard = compressorCurve({ ...base, ratio: 10 })(0);
    expect(gentle).toBeLessThan(0);
    expect(hard).toBeLessThan(gentle);
  });

  test("a parallel mix sits between the dry and the compressed curve", () => {
    const base = { ...defaults, autoMakeup: false, makeupDb: 0 };
    const dry = compressorCurve({ ...base, mix: 0 })(0);
    const wet = compressorCurve({ ...base, mix: 100 })(0);
    const half = compressorCurve({ ...base, mix: 50 })(0);
    expect(half).toBeLessThan(dry);
    expect(half).toBeGreaterThan(wet);
  });
});

test("the lookahead is the node's: 6 ms", () => {
  // Measured in Chrome: 264 samples at 44.1 kHz, 288 at 48 kHz.
  expect(COMPRESSOR_LOOKAHEAD_SECONDS).toBe(0.006);
});
