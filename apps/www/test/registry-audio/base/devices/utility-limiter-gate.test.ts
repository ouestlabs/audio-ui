import { describe, expect, test } from "bun:test";
import {
  GATE_WORKLET,
  gateCurve,
  gateDevice,
  gateSettings,
} from "@/registry-audio/bases/base/devices/gate/device";
import { createGateEngine } from "@/registry-audio/bases/base/devices/gate/engine";
import { limiterDevice } from "@/registry-audio/bases/base/devices/limiter/device";
import { createLimiterEngine } from "@/registry-audio/bases/base/devices/limiter/engine";
import {
  utilityDevice,
  utilitySettings,
} from "@/registry-audio/bases/base/devices/utility/device";
import { createUtilityEngine } from "@/registry-audio/bases/base/devices/utility/engine";

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
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
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
    delay: new FakeDelay(),
    filter: new FakeFilter(),
    gains: [] as FakeGain[],
    panner: new FakePanner(),
    shapers: [] as FakeShaper[],
  };
  const ctx = {
    createBiquadFilter: () => made.filter,
    createChannelMerger: () => new FakeNode(),
    createChannelSplitter: () => new FakeNode(),
    createDelay: () => made.delay,
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

describe("the limiter engine", () => {
  const defaults = limiterDevice.defaults();

  test("passes the signal at the input gain without worklets, and reads no reduction", async () => {
    const { ctx } = fakeContext();
    const engine = createLimiterEngine(ctx, { ...defaults, gainDb: 6 });
    expect(await engine.ready).toBe(false);
    expect(engine.reduction).toBe(0);
    engine.update({ ...defaults, gainDb: 3 });
    engine.dispose();
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

  test("the worklet gets the times in milliseconds and the floor as the range", () => {
    expect(
      gateSettings({
        ...defaults,
        attackMs: 2,
        floorDb: -40,
        holdMs: 50,
        lookaheadMs: 5,
        releaseMs: 200,
      }).modelParams
    ).toMatchObject({
      attack: 2,
      hold: 50,
      lookahead: 5,
      range: -40,
      release: 200,
    });
  });

  test("off, the gate is open and has no look-ahead", () => {
    const off = gateSettings({ ...defaults, enabled: false, lookaheadMs: 5 });
    expect(off.modelParams).toMatchObject({ lookahead: 0, range: 0 });
    expect(gateDevice.latency({ ...defaults, lookaheadMs: 5 }, 48_000)).toBe(
      0.005
    );
    expect(
      gateDevice.latency(
        { ...defaults, enabled: false, lookaheadMs: 5 },
        48_000
      )
    ).toBe(0);
  });

  test("the worklet source is the processor the engine makes", () => {
    expect(GATE_WORKLET).toContain('registerProcessor("audioui-gate"');
  });

  test("the engine stays open without worklets and follows updates", async () => {
    const { ctx } = fakeContext();
    const engine = createGateEngine(ctx, { ...defaults, lookaheadMs: 4 });
    expect(await engine.ready).toBe(false);
    engine.update({ ...defaults, lookaheadMs: 8 });
    engine.dispose();
  });
});
