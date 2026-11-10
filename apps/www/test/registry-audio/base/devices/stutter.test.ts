import { describe, expect, test } from "bun:test";
import stutter from "@audio/effect-stutter";
import {
  STUTTER_WORKLET,
  stutterCycle,
  stutterDevice,
  stutterSettings,
} from "@/registry-audio/bases/base/devices/stutter/device";
import { createStutterEngine } from "@/registry-audio/bases/base/devices/stutter/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = stutterDevice.defaults();
const TEMPO = { beatsPerBar: 4, bpm: 120, beatUnit: 4 } as const;

describe("the stutter device", () => {
  test("its lengths are note values of the tempo, the slice no longer than the interval", () => {
    expect(stutterSettings(defaults, TEMPO)).toMatchObject({
      interval: 0.5,
      slice: 0.125,
    });
    expect(
      stutterSettings({ ...defaults, interval: "1/16", slice: "1/4" }, TEMPO)
        .slice
    ).toBe(0.125);
  });

  test("one interval: the slice caught at full level, then each repeat quieter by the decay", () => {
    const cycle = stutterCycle({ ...defaults, decay: 50 });
    expect(cycle.beats).toBeCloseTo(1, 9);
    expect(cycle.slice).toBeCloseTo(0.25, 9);
    expect(cycle.level(0.1)).toBe(1);
    expect(cycle.level(0.3)).toBe(0.5);
    expect(cycle.level(0.8)).toBe(0.125);
  });

  test("off, nothing is mixed in", () => {
    expect(stutterSettings({ ...defaults, enabled: false }).mix).toBe(0);
  });
});

describe("the stutter's worklet", () => {
  interface Processor {
    port: { onmessage: (event: { data: unknown }) => void };
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ) => boolean;
  }
  const made = () => {
    class AudioWorkletProcessor {
      port = { onmessage: (_event: { data: unknown }) => undefined };
    }
    let Made: (new () => Processor) | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      "sampleRate",
      STUTTER_WORKLET
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
  };
  const parameters = Object.fromEntries(
    Object.entries(stutterSettings({ ...defaults, decay: 20 }, TEMPO)).map(
      ([name, value]) => [name, new Float32Array([value])]
    )
  );
  const reference = () => {
    const state: Record<string, number> = { fs: RATE };
    for (const [name, [value]] of Object.entries(parameters)) {
      state[name] = value ?? 0;
    }
    return state;
  };
  const ramp = (start: number) =>
    new Float32Array(BLOCK).map((_, frame) => Math.sin((start + frame) / 50));

  test("plays the package's stutter per channel", () => {
    const processor = made();
    const state = reference();
    for (let block = 0; block < 300; block += 1) {
      const input = ramp(block * BLOCK);
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      processor.process([[input]], [[left, right]], parameters);
      const expected = stutter(Float32Array.from(input), state);
      expect([...left]).toEqual([...expected]);
      expect([...right]).toEqual([...expected]);
    }
  });

  test("a trigger starts a fresh cycle at once, catching a slice from now", () => {
    const processor = made();
    for (let block = 0; block < 100; block += 1) {
      processor.process(
        [[ramp(block * BLOCK)]],
        [[new Float32Array(BLOCK)]],
        parameters
      );
    }
    processor.port.onmessage({ data: "trigger" });
    const state = reference();
    for (let block = 100; block < 200; block += 1) {
      const input = ramp(block * BLOCK);
      const output = new Float32Array(BLOCK);
      processor.process([[input]], [[output]], parameters);
      expect([...output]).toEqual([
        ...stutter(Float32Array.from(input), state),
      ]);
    }
  });
});

describe("createStutterEngine", () => {
  test("a context with no worklets lets the sound through clean, and says so", async () => {
    const gains: { gain: { value: number } }[] = [];
    const ctx = {
      createGain: () => {
        const gain = {
          connect: <T>(to: T) => to,
          disconnect: () => undefined,
          gain: { setTargetAtTime: () => undefined, value: 0 },
        };
        gains.push(gain);
        return gain;
      },
      currentTime: 0,
    } as unknown as BaseAudioContext;
    const engine = createStutterEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    expect(gains[2]?.gain.value).toBe(0);
    expect(gains[3]?.gain.value).toBe(1);
  });
});
