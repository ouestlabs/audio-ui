import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";

/** An analyser that hands out a sine of `amplitude` every time it is read. */
const analyserOf = (amplitude: number) =>
  ({
    fftSize: 2048,
    getFloatTimeDomainData: (buffer: Float32Array) => {
      for (let index = 0; index < buffer.length; index += 1) {
        buffer[index] = amplitude * Math.sin((2 * Math.PI * index) / 64);
      }
    },
  }) as unknown as AnalyserNode;

describe("useAudioLevels", () => {
  const original = {
    cancel: globalThis.cancelAnimationFrame,
    request: globalThis.requestAnimationFrame,
  };
  let pending: FrameRequestCallback[] = [];
  const fire = (now: number) => {
    const callbacks = pending;
    pending = [];
    for (const callback of callbacks) {
      callback(now);
    }
  };
  beforeEach(() => {
    globalThis.requestAnimationFrame = (callback) => {
      pending.push(callback);
      return pending.length;
    };
    globalThis.cancelAnimationFrame = () => undefined;
  });
  afterEach(() => {
    globalThis.requestAnimationFrame = original.request;
    globalThis.cancelAnimationFrame = original.cancel;
    pending = [];
  });

  test("the level is the RMS, how loud it sounds, and the peak the loudest sample, how near it comes to clipping", () => {
    const analysers = [analyserOf(0.5)];
    const view = renderHook(() => useAudioLevels(analysers));
    act(() => fire(performance.now() + 16));
    const { levels, peaks } = view.result.current.getSnapshot();
    // A sine at half scale: its loudest sample is 6 dB under full scale, its RMS 3 dB lower still.
    expect(levels[0]).toBeCloseTo(-9.03, 1);
    expect(peaks?.[0]).toBeCloseTo(-6.02, 1);
    view.unmount();
  });
});
