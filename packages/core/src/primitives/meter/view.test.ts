import { describe, expect, test } from "bun:test";
import {
  channelView,
  createMeterConfig,
  type MeterChannelNodes,
  paintChannel,
} from "./view.ts";

describe("Meter channel view", () => {
  test("reads a level on the scale, with its text and clipping and warning zones", () => {
    const config = createMeterConfig({
      clipThreshold: 0,
      locale: "en-US",
      max: 6,
      min: -60,
      warnThreshold: -6,
    });
    const view = channelView({ levels: [-60, -3, 2] }, 1, config);
    expect(view.percent).toBeCloseTo(57 / 66, 5);
    expect(view.warning).toBe(true);
    expect(view.clipping).toBe(false);
    expect(channelView({ levels: [2] }, 0, config).clipping).toBe(true);
  });

  test("a missing level reads as the floor, and the value is rounded to one decimal", () => {
    const config = createMeterConfig({ locale: "en-US" });
    const view = channelView({ levels: [-12.345] }, 0, config);
    expect(view.valueNow).toBe(-12.3);
    expect(channelView({ levels: [] }, 3, config).percent).toBe(0);
  });

  test("the peak is placed only when the frame has one for the channel", () => {
    const config = createMeterConfig({ locale: "en-US" });
    expect(channelView({ levels: [0] }, 0, config).peakPercent).toBeUndefined();
    expect(
      channelView({ levels: [0], peaks: [6] }, 0, config).peakPercent
    ).toBe(1);
  });
});

describe("Meter channel paint", () => {
  test("writes the indicator and the channel, and latches clipping until it is cleared", () => {
    const config = createMeterConfig({ locale: "en-US" });
    const indicator = document.createElement("div");
    const channel = document.createElement("div");
    const nodes: MeterChannelNodes = { channel, indicator };
    paintChannel(nodes, channelView({ levels: [3] }, 0, config), 0, "vertical");
    expect(indicator.style.transform).toBe(`scaleY(${63 / 66})`);
    expect(indicator.hasAttribute("data-clipped")).toBe(true);
    expect(channel.getAttribute("aria-valuenow")).toBe("3");
    paintChannel(
      nodes,
      channelView({ levels: [-20] }, 0, config),
      0,
      "vertical"
    );
    expect(indicator.hasAttribute("data-clipping")).toBe(false);
    expect(indicator.hasAttribute("data-clipped")).toBe(true);
  });
});
