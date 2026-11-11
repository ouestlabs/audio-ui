import { describe, expect, test } from "bun:test";
import { compressorDevice } from "@/registry-audio/bases/base/devices/compressor/device";
import { deesserDevice } from "@/registry-audio/bases/base/devices/deesser/device";
import { filterDevice } from "@/registry-audio/bases/base/devices/filter/device";
import { gateDevice } from "@/registry-audio/bases/base/devices/gate/device";
import { limiterDevice } from "@/registry-audio/bases/base/devices/limiter/device";
import { transientDevice } from "@/registry-audio/bases/base/devices/transient/device";

describe("a project saved with the Clean models", () => {
  test("plays on the audio.js model, and what a device no longer has is dropped", () => {
    expect(filterDevice.sanitize({ circuit: "clean" }).circuit).toBe("sem");
    expect(
      compressorDevice.sanitize({
        autoMakeup: true,
        external: true,
        model: "clean",
      } as never)
    ).not.toHaveProperty("external");
    expect(compressorDevice.sanitize({ model: "clean" } as never).model).toBe(
      "smooth"
    );
    expect(deesserDevice.sanitize({ model: "clean" } as never).model).toBe(
      "split"
    );
    for (const device of [gateDevice, limiterDevice, transientDevice]) {
      expect(device.sanitize({ model: "clean" } as never)).not.toHaveProperty(
        "model"
      );
    }
  });
});
