import { describe, expect, test } from "bun:test";
import {
  type ChannelParam,
  type ChannelStripState,
  channelStripDefaults,
  createChannelStripTools,
} from "@/registry-audio/bases/base/lib/channel-strip-tools";

const PARAMS: readonly ChannelParam[] = [
  { default: 0, max: 6, min: -60, name: "gain", unit: "dB" },
  { default: 0, max: 1, min: -1, name: "pan" },
  { default: -60, max: 0, min: -60, name: "reverbSend", unit: "dB" },
  { name: "mute", type: "toggle" },
];
const strip = createChannelStripTools({ params: PARAMS });

function state(): ChannelStripState {
  return channelStripDefaults(PARAMS);
}

describe("channelStripDefaults", () => {
  test("default, else min for continuous, false for toggle", () => {
    const defaults = channelStripDefaults([
      { max: 10, min: 2, name: "a" },
      { default: 5, max: 10, min: 0, name: "b" },
      { name: "m", type: "toggle" },
    ]);
    expect(defaults).toEqual({ a: 2, b: 5, m: false });
  });
});

describe("setParam", () => {
  test("clamps a continuous param into its range", () => {
    expect(
      strip.setParam.apply(state(), { param: "gain", value: 999 }).gain
    ).toBe(6);
    expect(
      strip.setParam.apply(state(), { param: "gain", value: -999 }).gain
    ).toBe(-60);
    expect(
      strip.setParam.apply(state(), { param: "pan", value: 0.3 }).pan
    ).toBe(0.3);
  });

  test("coerces a toggle to boolean", () => {
    expect(
      strip.setParam.apply(state(), { param: "mute", value: true }).mute
    ).toBe(true);
  });

  test("snaps to the param's step when given", () => {
    const stepped = createChannelStripTools({
      params: [{ max: 10, min: 0, name: "x", step: 0.5 }],
    });
    expect(stepped.setParam.apply({ x: 0 }, { param: "x", value: 0.7 }).x).toBe(
      0.5
    );
  });
});

describe("setParams (batch)", () => {
  test("applies several changes at once", () => {
    const next = strip.setParams.apply(state(), {
      changes: [
        { param: "gain", value: 3 },
        { param: "pan", value: -0.5 },
        { param: "mute", value: true },
      ],
    });
    expect(next).toMatchObject({ gain: 3, mute: true, pan: -0.5 });
  });
});

describe("reset", () => {
  test("restores every control to its default", () => {
    const moved = strip.setParam.apply(state(), { param: "gain", value: 6 });
    expect(strip.reset.apply(moved, {}).gain).toBe(0);
  });
});

describe("not hard-coded — arbitrary param sets", () => {
  test("an EQ + three-sends channel with no gain/pan/mute works", () => {
    const eq = createChannelStripTools({
      params: [
        { max: 12, min: -12, name: "eqLow", unit: "dB" },
        { max: 12, min: -12, name: "eqMid", unit: "dB" },
        { max: 12, min: -12, name: "eqHigh", unit: "dB" },
        { max: 0, min: -60, name: "sendA", unit: "dB" },
        { max: 0, min: -60, name: "sendB", unit: "dB" },
        { max: 0, min: -60, name: "sendC", unit: "dB" },
      ],
    });
    const next = eq.setParam.apply(
      { eqHigh: 0, eqLow: 0, eqMid: 0, sendA: -60, sendB: -60, sendC: -60 },
      { param: "eqHigh", value: 4 }
    );
    expect(next.eqHigh).toBe(4);
    expect(
      eq.setParam.schema.safeParse({ param: "sendC", value: -12 }).success
    ).toBe(true);
    // "gain" is not a control of THIS channel, so the schema rejects it
    expect(
      eq.setParam.schema.safeParse({ param: "gain", value: 0 }).success
    ).toBe(false);
  });
});

describe("schema guards", () => {
  test("rejects an unknown control, accepts a known one", () => {
    expect(
      strip.setParam.schema.safeParse({ param: "cowbell", value: 1 }).success
    ).toBe(false);
    expect(
      strip.setParam.schema.safeParse({ param: "gain", value: 1 }).success
    ).toBe(true);
  });
});
