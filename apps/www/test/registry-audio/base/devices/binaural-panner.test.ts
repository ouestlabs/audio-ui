import { describe, expect, test } from "bun:test";
import binaural from "@audio/spatial-binaural";
import {
  BINAURAL_PANNER_WORKLET,
  binauralPannerDevice,
  binauralPannerSettings,
  binauralPlace,
  binauralPoint,
  LARGEST_HEAD_M,
} from "@/registry-audio/bases/base/devices/binaural-panner/device";
import { createBinauralPannerEngine } from "@/registry-audio/bases/base/devices/binaural-panner/engine";

const RATE = 48_000;
const BLOCK = 128;
const defaults = binauralPannerDevice.defaults();

describe("the binaural panner device", () => {
  test("the top view puts in front up and the right to the right, and reads back the place it shows", () => {
    expect(binauralPoint({ ...defaults, azimuthDeg: 0 }).y).toBeGreaterThan(0);
    expect(binauralPoint({ ...defaults, azimuthDeg: 90 }).x).toBeGreaterThan(0);
    for (const place of [
      { azimuthDeg: -120, distanceM: 3 },
      { azimuthDeg: 45, distanceM: 0.5 },
      { azimuthDeg: 170, distanceM: 10 },
    ]) {
      const back = binauralPlace(binauralPoint({ ...defaults, ...place }));
      expect(back.azimuthDeg).toBeCloseTo(place.azimuthDeg, 6);
      expect(back.distanceM).toBeCloseTo(place.distanceM, 6);
    }
  });

  test("its settings are the kernel's, the head in metres; off, nothing is mixed in", () => {
    expect(binauralPannerSettings({ ...defaults, headCm: 10 })).toMatchObject({
      headRadius: 0.1,
    });
    expect(binauralPannerSettings({ ...defaults, enabled: false }).mix).toBe(0);
  });
});

describe("the binaural panner's worklet", () => {
  interface Processor {
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ) => boolean;
  }
  const made = () => {
    class AudioWorkletProcessor {}
    let Made: (new () => Processor) | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      "sampleRate",
      BINAURAL_PANNER_WORKLET
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

  test("plays the package's panner, its line made for the largest head, and the head can change live", () => {
    const processor = made();
    const settings = binauralPannerSettings({ ...defaults, azimuthDeg: 60 });
    const parametersOf = (headRadius: number) => ({
      azimuth: new Float32Array([settings.azimuth]),
      distance: new Float32Array([settings.distance]),
      headRadius: new Float32Array([headRadius]),
      mix: new Float32Array([settings.mix]),
    });
    const [azimuth = 0] = parametersOf(0.0875).azimuth;
    const reference: Record<string, unknown> = {
      azimuth,
      fs: RATE,
      headRadius: LARGEST_HEAD_M,
      mix: 1,
    };
    binaural(new Float32Array(0), new Float32Array(0), reference);
    for (let block = 0; block < 12; block += 1) {
      const headRadius = block < 6 ? 0.0875 : 0.06;
      const parameters = parametersOf(headRadius);
      Object.assign(reference, {
        distance: parameters.distance[0],
        headRadius: parameters.headRadius[0],
        mix: parameters.mix[0],
      });
      const input = new Float32Array(BLOCK).map((_, frame) =>
        Math.sin((2 * Math.PI * 500 * (block * BLOCK + frame)) / RATE)
      );
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      processor.process([[input]], [[left, right]], parameters);
      const [expectedLeft, expectedRight] = binaural(
        Float32Array.from(input),
        Float32Array.from(input),
        reference
      );
      expect([...left]).toEqual([...expectedLeft]);
      expect([...right]).toEqual([...expectedRight]);
    }
  });
});

describe("createBinauralPannerEngine", () => {
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
    const engine = createBinauralPannerEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    expect(gains[2]?.gain.value).toBe(0);
    expect(gains[3]?.gain.value).toBe(1);
  });
});
