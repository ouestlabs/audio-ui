import { describe, expect, test } from "bun:test";
import exciter from "@audio/effect-exciter";
import subbass from "@audio/effect-subbass";
import {
  BASS_ENHANCER_WORKLET,
  bassEnhancerBands,
  bassEnhancerDevice,
  bassEnhancerSettings,
} from "@/registry-audio/bases/base/devices/bass-enhancer/device";
import { createBassEnhancerEngine } from "@/registry-audio/bases/base/devices/bass-enhancer/engine";
import {
  EXCITER_WORKLET,
  exciterBand,
  exciterDevice,
  exciterSettings,
} from "@/registry-audio/bases/base/devices/exciter/device";
import { createExciterEngine } from "@/registry-audio/bases/base/devices/exciter/engine";

const RATE = 48_000;
const BLOCK = 128;

interface Processor {
  process: (
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) => boolean;
}

function made(source: string) {
  class AudioWorkletProcessor {}
  let Made: (new () => Processor) | undefined;
  new Function(
    "AudioWorkletProcessor",
    "registerProcessor",
    "sampleRate",
    source
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

const sine = (hz: number, start: number) =>
  new Float32Array(BLOCK).map((_, frame) =>
    Math.sin((2 * Math.PI * hz * (start + frame)) / RATE)
  );

/** The settings as the worklet's parameters, one value each. */
const parametersOf = (settings: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(settings).map(([name, value]) => [
      name,
      new Float32Array([value]),
    ])
  );

/** The parameters back as the numbers the worklet reads, rounded as they are. */
const readOf = (parameters: Record<string, Float32Array>) =>
  Object.fromEntries(
    Object.entries(parameters).map(([name, [value]]) => [name, value ?? 0])
  );

/** A context with gains only: no worklets. */
function gainsOnly() {
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
  return { ctx, gains };
}

describe("the exciter device", () => {
  const defaults = exciterDevice.defaults();

  test("its band is the kernel's high-pass: a Q of 2 peaks 6 dB at its corner, the band gone two octaves down", () => {
    const band = exciterBand({ ...defaults, frequencyHz: 3000 });
    expect(band(3000)).toBeCloseTo(20 * Math.log10(2), 2);
    expect(band(20_000)).toBeCloseTo(0, 0);
    expect(band(750)).toBeLessThan(-20);
  });

  test("the worklet plays the package's exciter per channel", () => {
    const parameters = parametersOf(
      exciterSettings({ ...defaults, amount: 80, drive: 70 })
    );
    const processor = made(EXCITER_WORKLET);
    const reference = { fs: RATE, ...readOf(parameters) };
    for (let block = 0; block < 6; block += 1) {
      const input = sine(5000, block * BLOCK);
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      processor.process([[input]], [[left, right]], parameters);
      const expected = exciter(Float32Array.from(input), reference);
      expect([...left]).toEqual([...expected]);
      expect([...right]).toEqual([...expected]);
    }
  });

  test("off, nothing is added; a context with no worklets lets it through clean", async () => {
    expect(exciterSettings({ ...defaults, enabled: false }).amount).toBe(0);
    const { ctx, gains } = gainsOnly();
    const engine = createExciterEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    // Input, output, processed, clean.
    expect(gains[2]?.gain.value).toBe(0);
    expect(gains[3]?.gain.value).toBe(1);
  });
});

describe("the bass enhancer device", () => {
  const defaults = bassEnhancerDevice.defaults();

  test("it takes the sub under the frequency and keeps its harmonics 2.5 times above", () => {
    const bands = bassEnhancerBands({ ...defaults, frequencyHz: 80 });
    expect(bands.harmonics(200)).toBeCloseTo(0, 6);
    expect(bands.harmonics(50)).toBeLessThan(-6);
    expect(bands.sub(20)).toBeCloseTo(0, 0);
    expect(bands.sub(400)).toBeLessThan(-24);
  });

  test("the worklet plays the package's bass enhancer per channel", () => {
    const parameters = parametersOf(
      bassEnhancerSettings({ ...defaults, amount: 90, keep: 30 })
    );
    const processor = made(BASS_ENHANCER_WORKLET);
    const reference = { fs: RATE, ...readOf(parameters) };
    for (let block = 0; block < 6; block += 1) {
      const input = sine(55, block * BLOCK);
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      processor.process([[input]], [[left, right]], parameters);
      const expected = subbass(Float32Array.from(input), reference);
      expect([...left]).toEqual([...expected]);
      expect([...right]).toEqual([...expected]);
    }
  });

  test("off, nothing is added and the sub is all kept; a context with no worklets lets it through clean", async () => {
    expect(
      bassEnhancerSettings({ ...defaults, enabled: false, keep: 0 })
    ).toMatchObject({ amount: 0, keep: 1 });
    const { ctx, gains } = gainsOnly();
    const engine = createBassEnhancerEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    expect(gains[2]?.gain.value).toBe(0);
    expect(gains[3]?.gain.value).toBe(1);
  });
});
