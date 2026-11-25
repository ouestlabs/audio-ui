import { describe, expect, test } from "bun:test";
import { latency } from "@audio/dynamics-limiter";
import { limiter } from "@audio/dynamics-limiter/audio";
import {
  LIMITER_WORKLET,
  limiterCurve,
  limiterDevice,
  limiterSettings,
} from "@/registry/bases/shared/devices/limiter/device";
import { MANIFEST_HOST } from "@/registry/lib/devices/manifest-worklet";
import { madeProcessor, type Processor, published } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = limiterDevice.defaults();
const lookahead = defaults;
const PREROLL = Math.ceil(0.1 * RATE);
const FADE = Math.round(0.03 * RATE);

/** A stereo sine at `amplitude`, `frames` long from frame `start`. */
const sine = (start: number, amplitude: number, frames = BLOCK) =>
  [220, 330].map(
    (hz) =>
      new Float32Array(frames).map(
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

/** The package's own processor at `state`, made as the worklet makes it, and how to play a block of any length through it. */
function packaged(state = lookahead) {
  const {
    ceiling,
    lookahead: ahead,
    release,
  } = limiterSettings(state).modelParams;
  const values = published(limiter, {
    ceiling,
    lookahead: ahead,
    release,
    truePeak: state.truePeak,
  });
  const run = limiter({
    ...MANIFEST_HOST,
    maxBlockSize: BLOCK,
    maxChannels: 2,
    params: values,
    sampleRate: RATE,
  });
  return (input: Float32Array[]) => {
    const frames = input[0]?.length ?? 0;
    const out = [new Float32Array(frames), new Float32Array(frames)];
    run([input], [out], values);
    return out;
  };
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
      const reference = published(limiter, {
        ceiling,
        lookahead: ahead,
        release,
        truePeak,
      });
      const run = limiter({
        ...MANIFEST_HOST,
        maxBlockSize: BLOCK,
        maxChannels: 2,
        params: reference,
        sampleRate: RATE,
      });
      let worst = 0;
      for (let block = 0; block < 40; block += 1) {
        const input = sine(block * BLOCK, 1.5);
        const expected = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
        run([input], [expected], reference);
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

  test("a parameter flagged restart makes the model again: it hears the last 100 ms, takes over in a fade, then plays as a fresh one would", () => {
    const { processor } = madeProcessor(LIMITER_WORKLET, "brickwall", RATE);
    const after = { ...lookahead, lookaheadMs: 2 };
    const at = 40;
    const old = packaged();
    for (let block = 0; block < at; block += 1) {
      played(processor, sine(block * BLOCK, 1.5));
      old(sine(block * BLOCK, 1.5));
    }
    // A fresh processor at the new look-ahead, fed what the worklet held.
    const fresh = packaged(after);
    const held = sine(at * BLOCK - PREROLL, 1.5, PREROLL);
    for (let from = 0; from < PREROLL; from += BLOCK) {
      fresh(held.map((channel) => channel.subarray(from, from + BLOCK)));
    }
    let afterFade = 0;
    let inFade = 0;
    for (let block = at; block < at + 30; block += 1) {
      const input = sine(block * BLOCK, 1.5);
      const out = played(processor, input, after);
      const coming = fresh(input);
      const going = old(input);
      for (let frame = 0; frame < BLOCK; frame += 1) {
        const time = (block - at) * BLOCK + frame;
        for (const channel of [0, 1] as const) {
          const sample = out[channel]?.[frame] ?? 0;
          const next = coming[channel]?.[frame] ?? 0;
          if (time >= FADE) {
            afterFade = Math.max(afterFade, Math.abs(sample - next));
          } else {
            // A line from the old one to the new.
            const share = time / FADE;
            const line =
              (going[channel]?.[frame] ?? 0) * (1 - share) + next * share;
            inFade = Math.max(inFade, Math.abs(sample - line));
          }
        }
      }
    }
    expect(afterFade).toBe(0);
    expect(inFade).toBeLessThan(1e-6);
  });

  test("a change that makes a model again waits 50 ms after the last one, so a knob turned all along is heard as it goes", () => {
    const { processor } = madeProcessor(LIMITER_WORKLET, "brickwall", RATE);
    const internal = processor as unknown as { playing: unknown };
    // A new look-ahead every block.
    const taken: number[] = [];
    let playing: unknown = null;
    for (let block = 0; block < 200; block += 1) {
      played(processor, sine(block * BLOCK, 1.5), {
        ...lookahead,
        lookaheadMs: 5 + block * 0.01,
      });
      if (internal.playing !== playing) {
        ({ playing } = internal);
        taken.push(block);
      }
    }
    const gaps = taken
      .slice(1)
      .map((block, index) => block - (taken[index] ?? 0));
    expect(Math.min(...gaps)).toBe(Math.ceil((0.05 * RATE) / BLOCK));
    expect(taken.length).toBeGreaterThan(8);
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
