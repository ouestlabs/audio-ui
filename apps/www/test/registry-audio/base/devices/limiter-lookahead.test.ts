import { describe, expect, test } from "bun:test";
import { latency } from "@audio/dynamics-limiter";
import { limiter } from "@audio/dynamics-limiter/audio";
import {
  LIMITER_WORKLET,
  limiterCurve,
  limiterDevice,
  limiterSettings,
} from "@/registry-audio/bases/base/devices/limiter/device";
import { madeProcessor, type Processor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = limiterDevice.defaults();
const lookahead = defaults;

/** A stereo sine at `amplitude`, frames `start` on. */
const sine = (start: number, amplitude: number) =>
  [220, 330].map(
    (hz) =>
      new Float32Array(BLOCK).map(
        (_, frame) =>
          amplitude * Math.sin((2 * Math.PI * hz * (start + frame)) / RATE)
      ) as Float32Array
  );

const parametersOf = (state = lookahead) =>
  Object.fromEntries(
    Object.entries(limiterSettings(state).modelParams).map(([name, value]) => [
      name,
      Float32Array.of(value),
    ])
  );

function played(
  processor: Processor,
  input: Float32Array[],
  state = lookahead
) {
  const out = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
  processor.process([input], [out], parametersOf(state));
  return out;
}

describe("the limiter's model", () => {
  test("plays the processor of @audio/dynamics-limiter as published, sample for sample", () => {
    for (const truePeak of [false, true]) {
      const state = { ...lookahead, truePeak };
      const { processor } = madeProcessor(LIMITER_WORKLET, "brickwall", RATE);
      const {
        ceiling,
        lookahead: ahead,
        release,
      } = limiterSettings(state).modelParams;
      const run = limiter({
        currentTime: 0,
        maxBlockSize: BLOCK,
        maxChannels: 2,
        params: {
          ceiling: Float32Array.of(ceiling),
          lookahead: Float32Array.of(ahead),
          release: Float32Array.of(release),
          truePeak,
        },
        sampleRate: RATE,
      });
      let worst = 0;
      for (let block = 0; block < 40; block += 1) {
        const input = sine(block * BLOCK, 1.5);
        const expected = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
        run([input], [expected], {});
        const out = played(processor, input, state);
        for (const channel of [0, 1] as const) {
          for (let frame = 0; frame < BLOCK; frame += 1) {
            worst = Math.max(
              worst,
              Math.abs(
                (out[channel]?.[frame] ?? 0) - (expected[channel]?.[frame] ?? 0)
              )
            );
          }
        }
      }
      expect({ truePeak, worst }).toEqual({ truePeak, worst: 0 });
    }
  });

  test("lets no sample over the ceiling, however hard it is pushed", () => {
    const { processor } = madeProcessor(LIMITER_WORKLET, "brickwall", RATE);
    const ceiling = 10 ** (defaults.ceilingDb / 20);
    let loudest = 0;
    for (let block = 0; block < 100; block += 1) {
      const out = played(processor, sine(block * BLOCK, 4));
      loudest = Math.max(
        loudest,
        ...out.flatMap((channel) => [...channel].map(Math.abs))
      );
    }
    expect(loudest).toBeLessThanOrEqual(ceiling * (1 + 1e-6));
    expect(loudest).toBeGreaterThan(ceiling * 0.95);
  });

  test("comes out as late as the device says, and its meter reads the gain against the sound as late", () => {
    for (const truePeak of [false, true]) {
      const state = { ...lookahead, lookaheadMs: 2, truePeak };
      const late = Math.round(limiterDevice.latency(state, RATE) * RATE);
      expect(late).toBe(latency({ lookahead: 2, sampleRate: RATE, truePeak }));
      const { posted, processor } = madeProcessor(
        LIMITER_WORKLET,
        "brickwall",
        RATE
      );
      // A click under the ceiling, at frame 10.
      const outs: number[] = [];
      for (let block = 0; block < 4; block += 1) {
        const click = new Float32Array(BLOCK);
        if (block === 0) {
          click[10] = 0.5;
        }
        outs.push(...played(processor, [click, click], state)[0]);
      }
      const at = outs.findIndex((sample) => Math.abs(sample) > 0.25);
      expect(at - 10).toBe(late);
      // Under the ceiling, nothing is taken off, even as the sound starts.
      const steady = madeProcessor(LIMITER_WORKLET, "brickwall", RATE);
      for (let block = 0; block < 40; block += 1) {
        played(steady.processor, sine(block * BLOCK, 0.3), state);
      }
      expect(Math.max(...steady.posted.slice(1).map(Math.abs))).toBeLessThan(
        0.05
      );
      expect(posted.length).toBeGreaterThan(0);
    }
  });
});

describe("the limiter device", () => {
  test("the worklet is made in its manifest's units, a toggle as 0 or 1", () => {
    const settings = limiterSettings({ ...lookahead, truePeak: true });
    expect(settings).toMatchObject({
      modelParams: { ceiling: -1, lookahead: 5, release: 100, truePeak: 1 },
      wet: 1,
    });
    expect(limiterSettings({ ...lookahead, enabled: false })).toMatchObject({
      gain: 1,
      wet: 0,
    });
  });

  test("its curve brings every level over the ceiling down to it, and its latency is its own", () => {
    const curve = limiterCurve({ ...lookahead, ceilingDb: -3, gainDb: 6 });
    expect(curve(-12)).toBe(-6);
    expect(curve(0)).toBe(-3);
    expect(limiterCurve({ ...lookahead, enabled: false })(-12)).toBe(-12);
    expect(limiterDevice.latency({ ...lookahead, enabled: false }, RATE)).toBe(
      0
    );
    expect(limiterDevice.latency(lookahead, RATE)).toBe(
      latency({ lookahead: 5, sampleRate: RATE }) / RATE
    );
  });
});
