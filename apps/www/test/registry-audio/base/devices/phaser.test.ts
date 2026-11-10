import { describe, expect, test } from "bun:test";
import phaser from "@audio/effect-phaser";
import {
  PHASER_WORKLET,
  phaserDevice,
  phaserSettings,
} from "@/registry-audio/bases/base/devices/phaser/device";
import { createPhaserEngine } from "@/registry-audio/bases/base/devices/phaser/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = phaserDevice.defaults();

interface Processor {
  process: (
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) => boolean;
}

function made() {
  class AudioWorkletProcessor {}
  let Made: (new () => Processor) | undefined;
  new Function(
    "AudioWorkletProcessor",
    "registerProcessor",
    "sampleRate",
    PHASER_WORKLET
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
}

/** A block of a 440 Hz sine, from frame `start`. */
const sine = (start: number) =>
  new Float32Array(BLOCK).map((_, frame) =>
    Math.sin((2 * Math.PI * 440 * (start + frame)) / RATE)
  );

const parametersOf = (stages: number) => {
  const settings = phaserSettings({ ...defaults, mode: "classic", stages });
  return {
    depth: new Float32Array([settings.classicDepth]),
    fc: new Float32Array([settings.center]),
    feedback: new Float32Array([settings.feedback]),
    rate: new Float32Array([settings.rate]),
    stages: new Float32Array([stages]),
  };
};

/** The package's phaser on a block, as the worklet plays it: its stages alone. */
function stagesOf(state: Record<string, unknown>, input: Float32Array) {
  const data = Float32Array.from(input);
  phaser(data, state);
  return data.map((sample, frame) => 2 * sample - (input[frame] ?? 0));
}

describe("the classic phaser", () => {
  test("its settings are the package's: a share of the centre, the stages", () => {
    expect(
      phaserSettings({ ...defaults, depth: 30, mode: "classic", stages: 8 })
    ).toMatchObject({
      classicDepth: 0.3,
      classicWet: defaults.mix / 100,
      flangerWet: 0,
      phaserWet: 0,
      stages: 8,
    });
  });

  test("the worklet plays the package's phaser, its stages alone", () => {
    const parameters = parametersOf(6);
    const left = new Float32Array(BLOCK);
    const right = new Float32Array(BLOCK);
    made().process([[sine(0), sine(0)]], [[left, right]], parameters);
    const expected = stagesOf(
      {
        depth: parameters.depth[0],
        fc: parameters.fc[0],
        feedback: parameters.feedback[0],
        fs: RATE,
        rate: parameters.rate[0],
        stages: 6,
      },
      sine(0)
    );
    expect([...left]).toEqual([...expected]);
    expect([...right]).toEqual([...expected]);
  });

  test("a new count of stages waits for the knob to rest, then fades in, its oscillator where it was", () => {
    const processor = made();
    const four = parametersOf(4);
    const eight = parametersOf(8);
    const state = (stages: number) => ({
      depth: four.depth[0],
      fc: four.fc[0],
      feedback: four.feedback[0],
      fs: RATE,
      rate: four.rate[0],
      stages,
    });
    const old: Record<string, unknown> = state(4);
    let fresh: Record<string, unknown> | undefined;
    const rest = Math.ceil((0.12 * RATE) / BLOCK);
    const fade = Math.ceil((0.08 * RATE) / BLOCK);
    for (let block = 0; block < 10 + rest + fade + 4; block += 1) {
      const input = sine(block * BLOCK);
      const output = new Float32Array(BLOCK);
      const turned = block >= 10;
      processor.process(
        [[input]],
        [[output, new Float32Array(BLOCK)]],
        turned ? eight : four
      );
      if (block === 10 + rest) {
        // The knob has rested: a fresh cascade, at the old one's phase.
        fresh = { ...state(8), _phase: old._phase };
      }
      const playing = stagesOf(old, input);
      const coming = fresh ? stagesOf(fresh, input) : undefined;
      if (block < 10 + rest) {
        expect([...output]).toEqual([...playing]);
      } else if (block > 10 + rest + fade && coming) {
        expect([...output]).toEqual([...coming]);
      }
    }
    expect(fresh).toBeDefined();
  });

  test("with nothing coming in, its stages ring out", () => {
    const processor = made();
    const parameters = {
      ...parametersOf(4),
      feedback: new Float32Array([0.9]),
    };
    processor.process([[sine(0)]], [[new Float32Array(BLOCK)]], parameters);
    const output = new Float32Array(BLOCK);
    processor.process([[]], [[output]], parameters);
    expect(Math.max(...output.map(Math.abs))).toBeGreaterThan(1e-4);
  });
});

describe("createPhaserEngine", () => {
  test("a context with no worklets plays the classic mode as the phaser", async () => {
    const gains: { gain: { value: number } }[] = [];
    const param = () => ({ setTargetAtTime: () => undefined, value: 0 });
    const node = () => ({
      connect: <T>(destination: T) => destination,
      disconnect: () => undefined,
    });
    const ctx = {
      createBiquadFilter: () => ({
        ...node(),
        detune: param(),
        frequency: param(),
        type: "",
      }),
      createDelay: () => ({ ...node(), delayTime: param() }),
      createGain: () => {
        const gain = { ...node(), gain: param() };
        gains.push(gain);
        return gain;
      },
      createOscillator: () => ({
        ...node(),
        frequency: param(),
        start: () => undefined,
        stop: () => undefined,
        type: "",
      }),
      currentTime: 0,
    } as unknown as BaseAudioContext;
    const engine = createPhaserEngine(ctx, {
      ...defaults,
      mix: 50,
      mode: "classic",
    });
    expect(await engine.ready).toBe(false);
    // Input, output, dry, phaser in, phaser feedback, phaser wet, phaser sweep, flanger feedback, flanger wet, flanger sweep, classic wet.
    expect(gains[5]?.gain.value).toBe(0.5);
    expect(gains[10]?.gain.value).toBe(0);
  });
});
