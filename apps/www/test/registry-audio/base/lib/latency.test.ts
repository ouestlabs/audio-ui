import { describe, expect, test } from "bun:test";
import { compressorDevice } from "@/registry-audio/bases/base/devices/compressor/device";
import { delayDevice } from "@/registry-audio/bases/base/devices/delay/device";
import { distortionDevice } from "@/registry-audio/bases/base/devices/distortion/device";
import { equalizerDevice } from "@/registry-audio/bases/base/devices/equalizer/device";
import { limiterDevice } from "@/registry-audio/bases/base/devices/limiter/device";
import { overdriveDevice } from "@/registry-audio/bases/base/devices/overdrive/device";
import { saturatorDevice } from "@/registry-audio/bases/base/devices/saturator/device";
import { waveShaperDevice } from "@/registry-audio/bases/base/devices/wave-shaper/device";
import { oversamplingSeconds } from "@/registry-audio/bases/base/lib/oversampling";

describe("the latency devices declare", () => {
  test("oversampling is a number of samples, so it follows the sample rate", () => {
    expect(oversamplingSeconds("4x", 48_000)).toBeCloseTo(0.004, 9);
    expect(oversamplingSeconds("4x", 96_000)).toBeCloseTo(0.002, 9);
    expect(oversamplingSeconds("2x", 48_000)).toBeCloseTo(128 / 48_000, 9);
    expect(oversamplingSeconds("none", 48_000)).toBe(0);
  });

  test("the limiter is its look-ahead when it works, nothing when it is off", () => {
    const on = limiterDevice.defaults();
    expect(limiterDevice.latency(on, 48_000)).toBeCloseTo(0.005, 9);
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
    expect(compressorDevice.latency(compressorDevice.defaults(), 48_000)).toBe(
      0
    );
    expect(equalizerDevice.latency(equalizerDevice.defaults(), 48_000)).toBe(0);
  });
});
