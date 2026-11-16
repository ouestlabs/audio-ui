import { describe, expect, test } from "bun:test";
import { createSource } from "@audio-ui/core";
import type { MeterFrame } from "@audio-ui/core/meter";
import { meter } from "../src/meter/index.ts";

describe("the meter primitive", () => {
  test("the channel count follows the array of levels", () => {
    const instance = meter({ id: "m", value: [-6, -12, -18] } as never);
    expect(instance.get().channelCount).toBe(3);
    instance.setOptions({ id: "m", value: [-6] } as never);
    expect(instance.get().channelCount).toBe(1);
  });

  test("the levels and their peaks are the frame it renders", () => {
    const instance = meter({ id: "m", peak: [-3], value: [-6] } as never);
    expect(instance.get().frame).toEqual({ levels: [-6], peaks: [-3] });
  });

  test("a live source gives the first frame to render, and its channel count", () => {
    const source = createSource<MeterFrame>({ levels: [-6, -12] });
    const instance = meter({ id: "m", source } as never);
    expect(instance.get().channelCount).toBe(2);
    expect(instance.get().frame.levels).toEqual([-6, -12]);
  });

  test("the range, the scale and the thresholds make the config", () => {
    const instance = meter({
      clipThreshold: 0,
      id: "m",
      max: 0,
      min: -60,
      scale: "linear",
      warnThreshold: -6,
    } as never);
    const { config } = instance.get();
    expect(config.position(-30)).toBe(0.5);
    expect(config.warnThreshold).toBe(-6);
  });

  test("a meter is vertical unless it says otherwise", () => {
    expect(meter({ id: "m" } as never).get().orientation).toBe("vertical");
    expect(
      meter({ id: "m", orientation: "horizontal" } as never).get().orientation
    ).toBe("horizontal");
  });
});
