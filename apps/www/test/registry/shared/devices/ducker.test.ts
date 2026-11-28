import { describe, expect, test } from "bun:test";
import { compressorGain } from "@audio/dynamics-compressor";
import { ducker } from "@audio/dynamics-ducker/audio";
import {
  DUCKER_WORKLET,
  type DuckerState,
  duckerCurve,
  duckerDevice,
  duckerSettings,
} from "@/registry/bases/shared/devices/ducker/device";
import { MANIFEST_HOST } from "@/registry/lib/devices/manifest-worklet";
import { contractParams } from "@/registry/lib/engine/device";
import { madeProcessor, published } from "./manifest-processor";

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

/** A state as the worklet's parameters, by id, a toggle as 0 or 1. */
const played = (state: DuckerState) =>
  Object.fromEntries(
    Object.entries(state).map(([id, value]) => [
      id,
      Float32Array.of(Number(value)),
    ])
  );

describe("duckerDevice as a processor's params", () => {
  test("gives each parameter of the processor the range it declares", () => {
    const derived = contractParams(duckerDevice);
    // The range is a cut: the knob says how far down, the processor a gain.
    const modelParams = {
      attack: "attackMs",
      knee: "kneeDb",
      range: "rangeDb",
      ratio: "ratio",
      release: "releaseMs",
      threshold: "thresholdDb",
    } as const;
    expect(Object.keys(ducker.params).sort()).toEqual(
      Object.keys(modelParams).sort()
    );
    for (const [name, id] of Object.entries(modelParams)) {
      const own = derived[id];
      const theirs = ducker.params[name as keyof typeof modelParams];
      if (own?.type !== "number") {
        throw new Error(`${id} is not a number`);
      }
      const negated = name === "range";
      expect({
        default: negated ? -own.default : own.default,
        max: negated ? 0 - own.min : own.max,
        min: negated ? -own.max : own.min,
        unit: own.unit,
      }).toEqual({
        default: theirs.default,
        max: theirs.max,
        min: theirs.min,
        unit: "unit" in theirs ? theirs.unit : undefined,
      });
    }
  });
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

  test("plays the processor of @audio/dynamics-ducker with the device's values: the sound on its first input, the key on its second", () => {
    const { processor } = madeProcessor(DUCKER_WORKLET, "ducker", RATE);
    const parameters = published(ducker, {});
    const run = ducker({
      ...MANIFEST_HOST,
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
        played(defaults)
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

  test("off, lets the sound through unchanged, and comes in over a line", () => {
    const { processor } = madeProcessor(DUCKER_WORKLET, "ducker", RATE);
    const loud = new Float32Array(BLOCK).fill(0.9);
    const run = (enabled: boolean) => {
      const out = new Float32Array(BLOCK);
      processor.process(
        [
          [loud, loud],
          [loud, loud],
        ],
        [[out, new Float32Array(BLOCK)]],
        played({ ...defaults, enabled })
      );
      return out;
    };
    for (let block = 0; block < 100; block += 1) {
      expect(run(false)).toEqual(loud);
    }
    const first = run(true);
    // 10 ms is 480 frames: one block in, it is part of the way there.
    expect(first[0]).toBeCloseTo(0.9, 2);
    expect(first[BLOCK - 1] ?? 0).toBeLessThan(first[0] ?? 0);
  });

  test("with nothing on the sidechain, it follows the sound itself", () => {
    const { processor } = madeProcessor(DUCKER_WORKLET, "ducker", RATE);
    let loudest = 0;
    for (let block = 0; block < 400; block += 1) {
      const sound = tone(block * BLOCK, 440, 0.5);
      const out = new Float32Array(BLOCK);
      processor.process(
        [[sound, sound], []],
        [[out, new Float32Array(BLOCK)]],
        played(defaults)
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
