import { describe, expect, test } from "bun:test";
import {
  channelEqBands,
  channelEqCurve,
  channelEqDevice,
} from "@/registry-audio/bases/base/lib/channel-eq-device";
import { createChannelEqEngine } from "@/registry-audio/bases/base/lib/channel-eq-engine";
import {
  overdriveBand,
  overdriveDevice,
  overdriveSettings,
  overdriveTable,
  TABLE_DOMAIN,
} from "@/registry-audio/bases/base/lib/overdrive-device";
import { createOverdriveEngine } from "@/registry-audio/bases/base/lib/overdrive-engine";
import {
  quantize,
  REDUX_WORKLET,
  reduxCurve,
  reduxDevice,
  reduxSettings,
  reduxTable,
} from "@/registry-audio/bases/base/lib/redux-device";
import { createReduxEngine } from "@/registry-audio/bases/base/lib/redux-engine";

class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
}
class FakeNode {
  disconnected = 0;
  connect<T>(to: T): T {
    return to;
  }
  disconnect() {
    this.disconnected += 1;
  }
}
class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}
class FakeFilter extends FakeNode {
  readonly frequency = new FakeParam();
  readonly gain = new FakeParam();
  readonly Q = new FakeParam();
  type = "";
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "";
}

function fakeContext() {
  const made = {
    filters: [] as FakeFilter[],
    gains: [] as FakeGain[],
    shaper: new FakeShaper(),
  };
  const ctx = {
    createBiquadFilter: () => {
      const filter = new FakeFilter();
      made.filters.push(filter);
      return filter;
    },
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    createWaveShaper: () => made.shaper,
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

describe("the channel EQ device", () => {
  const defaults = channelEqDevice.defaults();

  test("is flat by default, with the high-pass out of the way", () => {
    const curve = channelEqCurve(defaults);
    // The high-pass "off" is a 10 Hz one: under 0.1 dB at 30 Hz, nothing above.
    for (const hz of [30, 200, 1000, 5000, 15_000]) {
      expect(Math.abs(curve(hz))).toBeLessThan(0.1);
    }
  });

  test("the shelves sit at 100 Hz and 6 kHz, the mid goes where it is told", () => {
    const [, low, mid, high] = channelEqBands({ ...defaults, midHz: 2000 });
    expect(low?.frequency).toBe(100);
    expect(high?.frequency).toBe(6000);
    expect(mid?.frequency).toBe(2000);
  });

  test("a mid boost is at its gain at its frequency, the switch takes the lows out", () => {
    const boosted = channelEqCurve({ ...defaults, midDb: 6, midHz: 1000 });
    expect(boosted(1000)).toBeCloseTo(6, 0);
    const cut = channelEqCurve({ ...defaults, highPass: true });
    expect(cut(30)).toBeLessThan(-6);
    expect(cut(1000)).toBeCloseTo(0, 1);
  });

  test("off, the curve is flat whatever the knobs say", () => {
    expect(
      channelEqCurve({ ...defaults, enabled: false, midDb: 12 })(1000)
    ).toBe(0);
  });

  test("the engine has four filters and starts at the first state", () => {
    const { ctx, made } = fakeContext();
    createChannelEqEngine(ctx, { ...defaults, midDb: 5, midHz: 3000 });
    expect(made.filters.map((filter) => filter.type)).toEqual([
      "highpass",
      "lowshelf",
      "peaking",
      "highshelf",
    ]);
    expect(made.filters[2]?.frequency.value).toBe(3000);
    expect(made.filters[2]?.gain.value).toBe(5);
  });

  test("an update ramps; off flattens every band", () => {
    const { ctx, made } = fakeContext();
    const engine = createChannelEqEngine(ctx, { ...defaults, lowDb: 6 });
    engine.update({ ...defaults, enabled: false, lowDb: 6 });
    expect(made.filters[1]?.gain.targets.at(-1)).toBe(0);
  });
});

describe("the overdrive device", () => {
  const defaults = overdriveDevice.defaults();

  test("the band peaks at its centre and falls away from it", () => {
    const band = overdriveBand({ ...defaults, bandHz: 1000, width: 2 });
    expect(band(1000)).toBeCloseTo(0, 0);
    expect(band(100)).toBeLessThan(-12);
    expect(band(10_000)).toBeLessThan(-12);
  });

  test("the table is one soft clip and off is the clean sound", () => {
    const table = overdriveTable();
    expect(table).toHaveLength(4096);
    expect(table[0]).toBeCloseTo(Math.tanh(-TABLE_DOMAIN), 6);
    expect(overdriveSettings({ ...defaults, enabled: false })).toMatchObject({
      dry: 1,
      wet: 0,
    });
  });

  test("the engine puts a band-pass before a 4x shaper and ramps its knobs", () => {
    const { ctx, made } = fakeContext();
    const engine = createOverdriveEngine(ctx, defaults);
    expect(made.filters.map((filter) => filter.type)).toEqual([
      "bandpass",
      "lowpass",
    ]);
    expect(made.shaper.oversample).toBe("4x");
    engine.update({ ...defaults, bandHz: 2000 });
    expect(made.filters[0]?.frequency.targets).toEqual([2000]);
  });
});

describe("the redux device", () => {
  const defaults = reduxDevice.defaults();

  test("quantize keeps 2^(bits-1) steps each side and clips at full scale", () => {
    expect(quantize(0.3, 1)).toBe(0);
    expect(quantize(0.6, 1)).toBe(1);
    expect(quantize(0.3, 3)).toBeCloseTo(0.25, 9);
    expect(quantize(5, 8)).toBe(1);
    const levels = new Set(
      Array.from({ length: 2001 }, (_, i) => quantize(i / 1000 - 1, 3))
    );
    expect(levels.size).toBe(9);
  });

  test("the curve is the line at no mix and the stairs at full mix", () => {
    expect(reduxCurve({ ...defaults, mix: 0 })(0.3)).toBeCloseTo(0.3, 9);
    expect(reduxCurve({ ...defaults, bits: 2, mix: 100 })(0.3)).toBeCloseTo(
      0.5,
      9
    );
  });

  test("the table has one entry per step and matches the quantizer", () => {
    const table = reduxTable(4);
    expect(table).toHaveLength(65_537);
    expect(table[0]).toBe(-1);
    expect(table[65_536]).toBe(1);
  });

  test("the sample hold is a worklet that registers one processor", () => {
    expect(REDUX_WORKLET).toContain('registerProcessor("audioui-redux"');
    expect(REDUX_WORKLET).toContain("hold");
  });

  test("with no worklet in the context, the bits still work and ready says false", async () => {
    const { ctx, made } = fakeContext();
    const engine = createReduxEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    const first = made.shaper.curve;
    engine.update({ ...defaults, mix: 50 });
    expect(made.shaper.curve).toBe(first);
    engine.update({ ...defaults, bits: 3 });
    expect(made.shaper.curve).not.toBe(first);
    expect(reduxSettings({ ...defaults, enabled: false })).toMatchObject({
      dry: 1,
      wet: 0,
    });
  });
});
