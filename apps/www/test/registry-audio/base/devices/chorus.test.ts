import { describe, expect, test } from "bun:test";
import chorus from "@audio/effect-chorus";
import {
  CHORUS_WORKLET,
  chorusDevice,
  chorusSettings,
  chorusSweep,
} from "@/registry-audio/bases/base/devices/chorus/device";
import { createChorusEngine } from "@/registry-audio/bases/base/devices/chorus/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = chorusDevice.defaults();

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
    CHORUS_WORKLET
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

const parametersOf = (delayMs: number, voices: number) => {
  const settings = chorusSettings({ ...defaults, delayMs, voices });
  return {
    delay: new Float32Array([settings.delay]),
    depth: new Float32Array([settings.share]),
    rate: new Float32Array([settings.rate]),
    voices: new Float32Array([voices]),
  };
};

/** The package's chorus on a block, as the worklet plays it: its voices alone, as loud as one. */
function voicesOf(state: Record<string, unknown>, input: Float32Array) {
  const data = Float32Array.from(input);
  chorus(data, state);
  const loudness = Math.sqrt(state.voices as number);
  return data.map(
    (sample, frame) => (2 * sample - (input[frame] ?? 0)) * loudness
  );
}

describe("the chorus's voices", () => {
  test("the depth they take is the sweep as a share of the delay, the same sweep as one voice", () => {
    const settings = chorusSettings({ ...defaults, delayMs: 20, depth: 50 });
    expect(settings.share * 20).toBeCloseTo(settings.sweep * 1000, 9);
  });

  test("the panel draws each voice's sweep, spread around the cycle", () => {
    const state = { ...defaults, voices: 4 };
    const { rate } = chorusSettings(state);
    const quarter = 1 / rate / 4;
    expect(chorusSweep(state, undefined, 1)(0)).toBeCloseTo(
      chorusSweep(state, undefined, 0)(quarter),
      9
    );
    expect(chorusSweep({ ...defaults, voices: 1 })(0)).toBeCloseTo(
      defaults.delayMs,
      9
    );
  });

  test("the worklet plays the package's chorus, its voices alone", () => {
    const parameters = parametersOf(18, 3);
    const left = new Float32Array(BLOCK);
    const right = new Float32Array(BLOCK);
    const processor = made();
    const state = {
      delay: parameters.delay[0],
      depth: parameters.depth[0],
      fs: RATE,
      rate: parameters.rate[0],
      voices: 3,
    };
    // Past the delay, so the voices are sounding.
    for (let block = 0; block < 12; block += 1) {
      const input = sine(block * BLOCK);
      processor.process([[input, input]], [[left, right]], parameters);
      const expected = voicesOf(state, input);
      expect([...left]).toEqual([...expected]);
      expect([...right]).toEqual([...expected]);
    }
    expect(Math.max(...left.map(Math.abs))).toBeGreaterThan(0.1);
  });

  test("a new delay waits for the knob to rest, then fades in on a fresh line that holds the old one's sound, the oscillators where they were", () => {
    const processor = made();
    const before = parametersOf(18, 3);
    const after = parametersOf(30, 3);
    const state = (parameters: typeof before) => ({
      delay: parameters.delay[0],
      depth: parameters.depth[0],
      fs: RATE,
      rate: parameters.rate[0],
      voices: 3,
    });
    const old: Record<string, unknown> = state(before);
    let fresh: Record<string, unknown> | undefined;
    const rest = Math.ceil((0.12 * RATE) / BLOCK);
    const fade = Math.ceil((0.08 * RATE) / BLOCK);
    for (let block = 0; block < 20 + rest + fade + 4; block += 1) {
      const input = sine(block * BLOCK);
      const output = new Float32Array(BLOCK);
      const turned = block >= 20;
      processor.process(
        [[input]],
        [[output, new Float32Array(BLOCK)]],
        turned ? after : before
      );
      if (block === 20 + rest) {
        // The kernel's line, newest sound just before \`ptr\`, carried over in order.
        const held = old.buffer as Float64Array;
        const ptr = old.ptr as number;
        const length = Math.floor((after.delay[0] ?? 0) * 2 * RATE);
        const buffer = new Float64Array(length);
        for (let back = 1; back <= Math.min(length, held.length); back += 1) {
          buffer[length - back] =
            held[(ptr - back + held.length) % held.length] ?? 0;
        }
        fresh = {
          ...state(after),
          _phases: Float64Array.from(old._phases as Float64Array),
          buffer,
          ptr: 0,
        };
      }
      // The old line plays on with the new depth until it is replaced.
      old.depth = turned ? after.depth[0] : before.depth[0];
      const playing = voicesOf(old, input);
      const coming = fresh ? voicesOf(fresh, input) : undefined;
      if (block < 20 + rest) {
        expect([...output]).toEqual([...playing]);
      } else if (block > 20 + rest + fade && coming) {
        expect([...output]).toEqual([...coming]);
      }
    }
    expect(fresh).toBeDefined();
  });
});

describe("createChorusEngine", () => {
  test("a context with no worklets plays one voice, whatever the count", async () => {
    const gains: { gain: { value: number } }[] = [];
    const param = () => ({ setTargetAtTime: () => undefined, value: 0 });
    const node = () => ({
      connect: <T>(destination: T) => destination,
      disconnect: () => undefined,
    });
    const ctx = {
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
    const engine = createChorusEngine(ctx, { ...defaults, mix: 50, voices: 4 });
    expect(await engine.ready).toBe(false);
    // Input, output, dry, wet, sweep, voices wet.
    expect(gains[3]?.gain.value).toBe(0.5);
    expect(gains[5]?.gain.value).toBe(0);
  });
});
