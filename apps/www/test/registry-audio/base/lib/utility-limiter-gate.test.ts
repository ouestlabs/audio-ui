import { describe, expect, test } from "bun:test";
import {
  gateCurve,
  gateDevice,
  gateSettings,
  gateTable,
} from "@/registry-audio/bases/base/lib/gate-device";
import { createGateEngine } from "@/registry-audio/bases/base/lib/gate-engine";
import {
  limiterCurve,
  limiterDevice,
  limiterSettings,
} from "@/registry-audio/bases/base/lib/limiter-device";
import { createLimiterEngine } from "@/registry-audio/bases/base/lib/limiter-engine";
import {
  utilityDevice,
  utilitySettings,
} from "@/registry-audio/bases/base/lib/utility-device";
import { createUtilityEngine } from "@/registry-audio/bases/base/lib/utility-engine";

class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
}
class FakeNode {
  readonly connections: { to: unknown; from?: number; into?: number }[] = [];
  disconnected = 0;
  connect<T>(to: T, from?: number, into?: number): T {
    this.connections.push({ from, into, to });
    return to;
  }
  disconnect() {
    this.disconnected += 1;
  }
}
class FakeGain extends FakeNode {
  channelCount = 0;
  channelCountMode = "";
  channelInterpretation = "";
  readonly gain = new FakeParam();
}
class FakePanner extends FakeNode {
  readonly pan = new FakeParam();
}
class FakeFilter extends FakeNode {
  readonly frequency = new FakeParam();
  type = "";
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
}
class FakeCompressor extends FakeNode {
  readonly attack = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly release = new FakeParam();
  readonly threshold = new FakeParam();
  reduction = -3;
}

function fakeContext() {
  const made = {
    compressor: new FakeCompressor(),
    filter: new FakeFilter(),
    gains: [] as FakeGain[],
    panner: new FakePanner(),
    shapers: [] as FakeShaper[],
  };
  const ctx = {
    createBiquadFilter: () => made.filter,
    createChannelMerger: () => new FakeNode(),
    createChannelSplitter: () => new FakeNode(),
    createDynamicsCompressor: () => made.compressor,
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    createStereoPanner: () => made.panner,
    createWaveShaper: () => {
      const shaper = new FakeShaper();
      made.shapers.push(shaper);
      return shaper;
    },
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

describe("the utility device", () => {
  const defaults = utilityDevice.defaults();

  test("settings: gain in linear, pan from -1 to 1, width from 0 to 2", () => {
    const settings = utilitySettings({
      ...defaults,
      gainDb: 6,
      pan: -50,
      width: 150,
    });
    expect(settings.gain).toBeCloseTo(1.995, 2);
    expect(settings.pan).toBe(-0.5);
    expect(settings.width).toBe(1.5);
  });

  test("mono takes the width to 0, invert flips the sign, off passes unchanged", () => {
    expect(utilitySettings({ ...defaults, mono: true }).width).toBe(0);
    expect(utilitySettings({ ...defaults, invert: true }).gain).toBe(-1);
    expect(
      utilitySettings({ ...defaults, enabled: false, gainDb: 12, mono: true })
    ).toEqual({
      gain: 1,
      pan: 0,
      width: 1,
    });
  });

  test("pan reads C, L and R", () => {
    expect(utilityDevice.format("pan", 0)).toBe("C");
    expect(utilityDevice.format("pan", -30)).toBe("L30");
    expect(utilityDevice.format("pan", 100)).toBe("R100");
  });

  test("the engine takes a mono input to both sides and starts at the first state", () => {
    const { ctx, made } = fakeContext();
    createUtilityEngine(ctx, { ...defaults, pan: 40, width: 50 });
    const [input] = made.gains;
    expect(input?.channelCount).toBe(2);
    expect(input?.channelCountMode).toBe("explicit");
    expect(made.panner.pan.value).toBe(0.4);
    expect(made.gains.some((gain) => gain.gain.value === 0.5)).toBe(true);
  });

  test("an update ramps the width, the pan and the level; dispose lets go of all", () => {
    const { ctx, made } = fakeContext();
    const engine = createUtilityEngine(ctx, defaults);
    engine.update({ ...defaults, pan: -100 });
    expect(made.panner.pan.targets).toEqual([-1]);
    engine.dispose();
    expect(made.gains.every((gain) => gain.disconnected === 1)).toBe(true);
  });
});

describe("the limiter device", () => {
  const defaults = limiterDevice.defaults();

  test("a signal under the ceiling is as loud as the gain makes it", () => {
    const curve = limiterCurve({ ...defaults, ceilingDb: -6, gainDb: 3 });
    expect(curve(-30)).toBeCloseTo(-27, 0);
  });

  test("a signal over the ceiling stays near it, far over barely moves it", () => {
    const curve = limiterCurve({ ...defaults, ceilingDb: -6, gainDb: 0 });
    expect(curve(0)).toBeLessThan(-5);
    expect(curve(0)).toBeGreaterThan(-6.5);
    expect(curve(-3) - curve(0)).toBeLessThan(0.2);
  });

  test("off is the straight line", () => {
    expect(limiterCurve({ ...defaults, enabled: false })(-12)).toBe(-12);
    expect(limiterSettings({ ...defaults, enabled: false })).toMatchObject({
      gain: 1,
      wet: 0,
    });
  });

  test("the engine is a ratio of 20 with no knee, takes its make-up out and reads the reduction", () => {
    const { ctx, made } = fakeContext();
    const engine = createLimiterEngine(ctx, {
      ...defaults,
      ceilingDb: -6,
      releaseMs: 200,
    });
    expect(made.compressor.ratio.value).toBe(20);
    expect(made.compressor.knee.value).toBe(0);
    expect(made.compressor.threshold.value).toBe(-6);
    expect(made.compressor.release.value).toBe(0.2);
    expect(engine.reduction).toBe(-3);
    engine.update({ ...defaults, ceilingDb: -12 });
    expect(made.compressor.threshold.targets).toEqual([-12]);
  });
});

describe("the gate device", () => {
  const defaults = gateDevice.defaults();

  test("the curve passes above the threshold and turns down by the floor below it", () => {
    const curve = gateCurve({ ...defaults, floorDb: -60, thresholdDb: -30 });
    expect(curve(-20)).toBe(-20);
    expect(curve(-40)).toBe(-100);
    expect(gateCurve({ ...defaults, enabled: false })(-80)).toBe(-80);
  });

  test("the response is a low-pass cutoff: the slower it is, the lower", () => {
    const fast = gateSettings({ ...defaults, responseMs: 5 }).smoothingHz;
    const slow = gateSettings({ ...defaults, responseMs: 100 }).smoothingHz;
    expect(fast).toBeGreaterThan(slow * 10);
  });

  test("the table is the floor under the threshold and 1 above it, and all open when off", () => {
    const table = gateTable({ enabled: true, floorDb: -40, thresholdDb: -20 });
    const at = (level: number) =>
      table[Math.round(((level + 1) / 2) * (table.length - 1))];
    expect(at(0.05)).toBeCloseTo(0.01, 6);
    expect(at(0.5)).toBe(1);
    expect(
      gateTable({ enabled: false, floorDb: -40, thresholdDb: -20 }).every(
        (v) => v === 1
      )
    ).toBe(true);
  });

  test("the engine rectifies, smooths, steps and gates; the table is rebuilt only when it changes", () => {
    const { ctx, made } = fakeContext();
    const engine = createGateEngine(ctx, defaults);
    const [rectifier, step] = made.shapers;
    expect(Array.from(rectifier?.curve ?? [])).toEqual([1, 0, 1]);
    const first = step?.curve;
    engine.update({ ...defaults, responseMs: 100 });
    expect(step?.curve).toBe(first);
    engine.update({ ...defaults, thresholdDb: -20 });
    expect(step?.curve).not.toBe(first);
    expect(made.filter.type).toBe("lowpass");
  });
});
