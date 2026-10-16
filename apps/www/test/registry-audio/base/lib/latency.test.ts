import { describe, expect, test } from "bun:test";
import { compressorDevice } from "@/registry-audio/bases/base/lib/compressor-device";
import { delayDevice } from "@/registry-audio/bases/base/lib/delay-device";
import { distortionDevice } from "@/registry-audio/bases/base/lib/distortion-device";
import { equalizerDevice } from "@/registry-audio/bases/base/lib/equalizer-device";
import { limiterDevice } from "@/registry-audio/bases/base/lib/limiter-device";
import { overdriveDevice } from "@/registry-audio/bases/base/lib/overdrive-device";
import { oversamplingSeconds } from "@/registry-audio/bases/base/lib/oversampling";
import { saturatorDevice } from "@/registry-audio/bases/base/lib/saturator-device";
import { waveShaperDevice } from "@/registry-audio/bases/base/lib/wave-shaper-device";

describe("the latency devices declare", () => {
  test("oversampling is a number of samples, so it follows the sample rate", () => {
    expect(oversamplingSeconds("4x", 48_000)).toBeCloseTo(0.004, 9);
    expect(oversamplingSeconds("4x", 96_000)).toBeCloseTo(0.002, 9);
    expect(oversamplingSeconds("2x", 48_000)).toBeCloseTo(128 / 48_000, 9);
    expect(oversamplingSeconds("none", 48_000)).toBe(0);
  });

  test("the compressor is the look-ahead of its node, on or off", () => {
    const on = compressorDevice.defaults();
    expect(compressorDevice.latency(on, 48_000)).toBeCloseTo(0.006, 9);
    expect(
      compressorDevice.latency({ ...on, enabled: false }, 48_000)
    ).toBeCloseTo(0.006, 9);
  });

  test("the limiter is the look-ahead and the oversampling when it works, nothing when it is off", () => {
    const on = limiterDevice.defaults();
    expect(limiterDevice.latency(on, 48_000)).toBeCloseTo(0.01, 9);
    expect(limiterDevice.latency({ ...on, enabled: false }, 48_000)).toBe(0);
  });

  test("the devices whose shaper oversamples 4x say 4 ms at 48 kHz", () => {
    for (const device of [
      distortionDevice,
      saturatorDevice,
      overdriveDevice,
      waveShaperDevice,
    ]) {
      expect(device.latency(device.defaults() as never, 48_000)).toBeCloseTo(
        0.004,
        9
      );
    }
  });

  test("a device with none declared adds none", () => {
    expect(delayDevice.latency(delayDevice.defaults(), 48_000)).toBe(0);
    expect(equalizerDevice.latency(equalizerDevice.defaults(), 48_000)).toBe(0);
  });
});
