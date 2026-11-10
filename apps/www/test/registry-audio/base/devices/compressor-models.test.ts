import { describe, expect, test } from "bun:test";
import { compressorGain } from "@audio/dynamics-compressor";
import {
  COMPRESSOR_MODELS,
  COMPRESSOR_MODELS_WORKLET,
  compressorCurve,
  compressorDevice,
  compressorSettings,
  compressorUnused,
  modelCurve,
} from "@/registry-audio/bases/base/devices/compressor/device";
import { createCompressorEngine } from "@/registry-audio/bases/base/devices/compressor/engine";
import { madeProcessor, type Processor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const PREROLL = Math.ceil(0.1 * RATE);
const FADE = Math.round(0.03 * RATE);
const defaults = compressorDevice.defaults();
const MODELS = Object.keys(
  COMPRESSOR_MODELS
) as (keyof typeof COMPRESSOR_MODELS)[];

const made = (model: string) =>
  madeProcessor(COMPRESSOR_MODELS_WORKLET, model, RATE);

/** A block of two channels. */
type Stereo = [Float32Array, Float32Array];

/** A loud stereo signal, frames `start` on: two sines, the right a fifth up and quieter. */
const signal = (start: number, frames = BLOCK): Stereo => [
  new Float32Array(frames).map(
    (_, frame) => 0.9 * Math.sin((2 * Math.PI * 220 * (start + frame)) / RATE)
  ),
  new Float32Array(frames).map(
    (_, frame) => 0.5 * Math.sin((2 * Math.PI * 330 * (start + frame)) / RATE)
  ),
];

const parametersOf = (state = defaults) =>
  Object.fromEntries(
    Object.entries(compressorSettings(state).modelParams).map(
      ([name, value]) => [name, Float32Array.of(value)]
    )
  );

/** The package's processor, made as the worklet makes it: the values it reads, and how to play a block through it. */
function packaged(model: keyof typeof COMPRESSOR_MODELS, state = defaults) {
  const manifest = COMPRESSOR_MODELS[model];
  const knobs = parametersOf(state);
  const values = Object.fromEntries(
    Object.entries(manifest.params).map(([name, param]) => [
      name,
      Float32Array.of(
        name === "makeup" ? 0 : (knobs[name]?.[0] ?? (param.default as number))
      ),
    ])
  );
  const run = manifest({
    currentTime: 0,
    maxBlockSize: BLOCK,
    maxChannels: 2,
    params: values,
    sampleRate: RATE,
  });
  const play = (input: Float32Array[]) => {
    const frames = input[0]?.length ?? 0;
    const out: Stereo = [new Float32Array(frames), new Float32Array(frames)];
    run([input], [out], values);
    return out;
  };
  return { play, values };
}

/** A block through the worklet. */
function played(processor: Processor, input: Float32Array[], state = defaults) {
  const out: Stereo = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
  processor.process([input], [out], parametersOf(state));
  return out;
}

const farthest = (a: Float32Array[], b: Float32Array[]) =>
  Math.max(
    ...a.flatMap((channel, index) =>
      [...channel].map((sample, frame) =>
        Math.abs(sample - (b[index]?.[frame] ?? 0))
      )
    )
  );

describe("the compressor's models", () => {
  test("each plays its audio.js package's processor as published, sample for sample", () => {
    for (const model of MODELS) {
      const { processor } = made(model);
      const reference = packaged(model);
      let worst = 0;
      for (let block = 0; block < 40; block += 1) {
        const input = signal(block * BLOCK);
        worst = Math.max(
          worst,
          farthest(played(processor, input), reference.play(input))
        );
      }
      expect({ model, worst }).toEqual({ model, worst: 0 });
    }
  });

  test("a parameter flagged restart makes the model again: it hears the last 100 ms, takes over in a fade, then plays as a fresh one would", () => {
    const { processor } = made("vca");
    const after = { ...defaults, thresholdDb: -30 };
    const at = 40;
    const old = packaged("vca");
    for (let block = 0; block < at; block += 1) {
      played(processor, signal(block * BLOCK));
      old.play(signal(block * BLOCK));
    }
    // A fresh processor at the new threshold, fed what the worklet held.
    const fresh = packaged("vca", after);
    const held = signal(at * BLOCK - PREROLL, PREROLL);
    for (let from = 0; from < PREROLL; from += BLOCK) {
      fresh.play(held.map((channel) => channel.subarray(from, from + BLOCK)));
    }
    let afterFade = 0;
    let inFade = 0;
    for (let block = at; block < at + 30; block += 1) {
      const input = signal(block * BLOCK);
      const out = played(processor, input, after);
      const coming = fresh.play(input);
      const going = old.play(input);
      for (let frame = 0; frame < BLOCK; frame += 1) {
        const time = (block - at) * BLOCK + frame;
        for (const channel of [0, 1] as const) {
          const sample = out[channel][frame] ?? 0;
          const next = coming[channel][frame] ?? 0;
          if (time >= FADE) {
            afterFade = Math.max(afterFade, Math.abs(sample - next));
          } else {
            // A line from the old one to the new.
            const share = time / FADE;
            const line =
              (going[channel][frame] ?? 0) * (1 - share) + next * share;
            inFade = Math.max(inFade, Math.abs(sample - line));
          }
        }
      }
    }
    expect(afterFade).toBe(0);
    expect(inFade).toBeLessThan(1e-6);
  });

  test("a change that makes a model again waits 50 ms after the last one, so a knob turned all along is heard as it goes", () => {
    const { processor } = made("fet");
    const internal = processor as unknown as { playing: unknown };
    // A new threshold every block.
    const taken: number[] = [];
    let playing: unknown = null;
    for (let block = 0; block < 200; block += 1) {
      played(processor, signal(block * BLOCK), {
        ...defaults,
        thresholdDb: -10 - block * 0.1,
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

  test("a parameter its manifest reads as it plays changes at once, with no new model", () => {
    const { processor } = made("smooth");
    const reference = packaged("smooth");
    let worst = 0;
    for (let block = 0; block < 40; block += 1) {
      const state = block < 20 ? defaults : { ...defaults, thresholdDb: -36 };
      if (reference.values.threshold) {
        reference.values.threshold[0] = state.thresholdDb;
      }
      const input = signal(block * BLOCK);
      worst = Math.max(
        worst,
        farthest(played(processor, input, state), reference.play(input))
      );
    }
    expect(worst).toBe(0);
  });

  test("a new model, sent by message, takes over in a fade and then plays as a fresh one would", () => {
    const { processor } = made("vca");
    for (let block = 0; block < 40; block += 1) {
      played(processor, signal(block * BLOCK));
    }
    processor.port.onmessage?.({ data: { model: "opto" } });
    const fresh = packaged("opto");
    const held = signal(40 * BLOCK - PREROLL, PREROLL);
    for (let from = 0; from < PREROLL; from += BLOCK) {
      fresh.play(held.map((channel) => channel.subarray(from, from + BLOCK)));
    }
    let worst = 0;
    for (let block = 40; block < 70; block += 1) {
      const input = signal(block * BLOCK);
      const out = played(processor, input);
      const expected = fresh.play(input);
      if ((block - 40) * BLOCK >= FADE) {
        worst = Math.max(worst, farthest(out, expected));
      }
    }
    expect(worst).toBe(0);
  });

  test("posts the gain it takes off, in dB, about every 10 ms: nothing on silence", () => {
    const { posted, processor } = made("vca");
    for (let block = 0; block < 40; block += 1) {
      played(processor, signal(block * BLOCK));
    }
    // Every 4 blocks of 128: the first 512 frames past 10 ms.
    expect(posted.length).toBe(10);
    const loud = posted.at(-1) ?? 0;
    expect(loud).toBeLessThan(-3);
    const silence = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
    for (let block = 0; block < 10; block += 1) {
      played(processor, silence);
    }
    expect(posted.at(-1)).toBe(0);
  });

  test("with nothing coming in, it plays on silence a second at least, then rests", () => {
    const { processor } = made("vca");
    for (let block = 0; block < 10; block += 1) {
      played(processor, signal(block * BLOCK));
    }
    const quiet = Math.ceil(RATE / BLOCK);
    for (let block = 0; block < quiet + 2; block += 1) {
      const out = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
      expect(processor.process([[]], [out], parametersOf())).toBe(true);
    }
    expect(
      (processor as unknown as { quiet: number }).quiet
    ).toBeGreaterThanOrEqual(RATE);
    expect((processor as unknown as { quiet: number }).quiet).toBeLessThan(
      RATE + 2 * BLOCK
    );
  });
});

describe("modelCurve", () => {
  test("a feed-forward model's curve is the package's static curve at its threshold, ratio and knee", () => {
    const params = compressorSettings(defaults).modelParams;
    for (const model of ["smooth", "vca", "fet", "opto"] as const) {
      const curve = modelCurve(model, params);
      for (const inputDb of [-60, -30, -20, -18, -15, -10, 0, 6]) {
        expect(curve(inputDb)).toBeCloseTo(
          inputDb +
            compressorGain(
              inputDb,
              params.threshold,
              params.ratio,
              params.knee
            ),
          2
        );
      }
    }
  });

  test("the vari-mu reads its own output: it takes off less than its ratio at the level going in would, more the harder it is pushed", () => {
    const params = compressorSettings(defaults).modelParams;
    const curve = modelCurve("varimu", params);
    expect(curve(-40)).toBeCloseTo(-40, 2);
    const reduction = (inputDb: number) => inputDb - curve(inputDb);
    expect(reduction(-10)).toBeGreaterThan(reduction(-14));
    expect(reduction(0) - reduction(-6)).toBeGreaterThan(
      reduction(-12) - reduction(-18)
    );
  });

  test("compressorCurve adds the make-up after a model, and mixes it with the dry sound", () => {
    const state = { ...defaults, makeupDb: 6, model: "vca" as const };
    const wet = modelCurve("vca", compressorSettings(state).modelParams);
    expect(compressorCurve(state)(0)).toBeCloseTo(wet(0) + 6, 6);
    const half = compressorCurve({ ...state, mix: 50 })(0);
    expect(half).toBeCloseTo(
      20 * Math.log10(0.5 + 0.5 * 10 ** ((wet(0) + 6) / 20)),
      6
    );
  });
});

describe("compressorUnused", () => {
  test("the clean model uses everything; the others not its auto make-up and sidechain, nor a knob their manifest has no parameter for", () => {
    expect(compressorUnused("clean")).toEqual([]);
    expect(compressorUnused("vca")).toEqual(["autoMakeup", "external"]);
    expect(compressorUnused("opto")).toEqual([
      "autoMakeup",
      "external",
      "releaseMs",
    ]);
    expect(compressorUnused("varimu")).toEqual([
      "autoMakeup",
      "external",
      "ratio",
    ]);
  });
});

describe("compressorSettings with a model", () => {
  test("the model plays the mix, with the make-up after it; the node and the key are silent", () => {
    const settings = compressorSettings({
      ...defaults,
      external: true,
      makeupDb: 4,
      mix: 80,
      model: "fet",
    });
    expect(settings).toMatchObject({
      external: false,
      keyedWet: 0,
      modelTrimDb: 4,
      modelWet: 0.8,
      nativeWet: 0,
    });
    expect(settings.dry).toBeCloseTo(0.2, 9);
  });
});

describe("the engine with a model", () => {
  test("in a context with no worklets the node plays for it, at its mix", () => {
    class Param {
      value = 0;
      setTargetAtTime() {
        return this;
      }
      setValueAtTime() {
        return this;
      }
    }
    class Node {
      connect<T>(destination: T) {
        return destination;
      }
      disconnect = () => undefined;
    }
    const gains: { gain: Param }[] = [];
    const ctx = {
      createDelay: () => Object.assign(new Node(), { delayTime: new Param() }),
      createDynamicsCompressor: () =>
        Object.assign(new Node(), {
          attack: new Param(),
          knee: new Param(),
          ratio: new Param(),
          reduction: -3,
          release: new Param(),
          threshold: new Param(),
        }),
      createGain: () => {
        const gain = Object.assign(new Node(), { gain: new Param() });
        gains.push(gain);
        return gain;
      },
      currentTime: 0,
    } as unknown as BaseAudioContext;
    const engine = createCompressorEngine(ctx, {
      ...defaults,
      mix: 60,
      model: "vca",
    });
    // input, output, dry, trim, wet: the node's wet carries the mix.
    expect(gains[4]?.gain.value).toBeCloseTo(0.6, 9);
    expect(engine.reduction).toBe(-3);
  });
});
