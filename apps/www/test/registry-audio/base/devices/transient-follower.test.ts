import { describe, expect, test } from "bun:test";
import { transientShaper } from "@audio/dynamics-transient-shaper/audio";
import {
  TRANSIENT_WORKLET,
  transientDevice,
  transientSettings,
} from "@/registry-audio/bases/base/devices/transient/device";
import { madeProcessor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = transientDevice.defaults();
const follower = defaults;

/** Hits: a decaying tone every 250 ms. */
const hits = (start: number) =>
  [0, 1].map(
    () =>
      new Float32Array(BLOCK).map((_, frame) => {
        const at = start + frame;
        const since = at % 12_000;
        return (
          0.5 *
          Math.exp(-since / 2400) *
          Math.sin((2 * Math.PI * 180 * at) / RATE)
        );
      }) as Float32Array
  );

const parametersOf = (state = follower) =>
  Object.fromEntries(
    Object.entries(transientSettings(state).modelParams).map(
      ([name, value]) => [name, Float32Array.of(value)]
    )
  );

describe("the transient shaper's model", () => {
  test("plays the processor of @audio/dynamics-transient-shaper as published, its amounts changed as it plays", () => {
    const { processor } = madeProcessor(TRANSIENT_WORKLET, "shaper", RATE);
    const first = parametersOf();
    const run = transientShaper({
      currentTime: 0,
      maxBlockSize: BLOCK,
      maxChannels: 2,
      params: first,
      sampleRate: RATE,
    });
    let worst = 0;
    for (let block = 0; block < 300; block += 1) {
      // Halfway, the attack goes down: it changes at once, with no new model.
      const state =
        block < 150 ? follower : { ...follower, attackDb: -9, sustainDb: 4 };
      const parameters = parametersOf(state);
      const input = hits(block * BLOCK);
      const expected = new Float32Array(BLOCK);
      run([input], [[expected, new Float32Array(BLOCK)]], parameters);
      const out = new Float32Array(BLOCK);
      processor.process([input], [[out, new Float32Array(BLOCK)]], parameters);
      for (let frame = 0; frame < BLOCK; frame += 1) {
        worst = Math.max(
          worst,
          Math.abs((out[frame] ?? 0) - (expected[frame] ?? 0))
        );
      }
    }
    expect(worst).toBe(0);
  });

  test("an attack all attack gets the decibels asked: the amounts go on as a share of the gain", () => {
    const { modelParams } = transientSettings({
      ...follower,
      attackDb: 6,
      sustainDb: -6,
    });
    expect(20 * Math.log10(1 + modelParams.attackGain)).toBeCloseTo(6, 9);
    expect(20 * Math.log10(1 + modelParams.sustainGain)).toBeCloseTo(-6, 9);
  });
});
