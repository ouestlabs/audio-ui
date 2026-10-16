import { describe, expect, test } from "bun:test";
import {
  COMPRESSOR_LOOKAHEAD_SECONDS,
  compressorDevice,
  compressorSettings,
} from "@/registry-audio/bases/base/lib/compressor-device";
import { createCompressorEngine } from "@/registry-audio/bases/base/lib/compressor-engine";

class FakeParam {
  value = 0;
  readonly targets: { time: number; timeConstant: number; value: number }[] =
    [];
  setTargetAtTime(value: number, time: number, timeConstant: number) {
    this.targets.push({ time, timeConstant, value });
    return this;
  }
}

class FakeNode {
  readonly connections: unknown[] = [];
  disconnected = 0;
  connect<T>(destination: T): T {
    this.connections.push(destination);
    return destination;
  }
  disconnect() {
    this.disconnected += 1;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}
class FakeCompressor extends FakeNode {
  readonly attack = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly release = new FakeParam();
  readonly threshold = new FakeParam();
  reduction = 0;
}
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
}

function fakeContext() {
  const created = {
    compressor: new FakeCompressor(),
    delay: new FakeDelay(),
    gains: [] as FakeGain[],
  };
  const ctx = {
    createDelay: () => created.delay,
    createDynamicsCompressor: () => created.compressor,
    createGain: () => {
      const gain = new FakeGain();
      created.gains.push(gain);
      return gain;
    },
    currentTime: 1.5,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = compressorDevice.defaults();

describe("createCompressorEngine", () => {
  test("starts the node at the first state, not at its own defaults", () => {
    const { created, ctx } = fakeContext();
    createCompressorEngine(ctx, { ...defaults, ratio: 8, thresholdDb: -30 });
    expect(created.compressor.ratio.value).toBe(8);
    expect(created.compressor.threshold.value).toBe(-30);
    expect(created.compressor.knee.value).toBe(defaults.kneeDb);
    expect(created.compressor.attack.value).toBeCloseTo(0.005, 12);
  });

  test("looks ahead on the dry path by as long as the node does", () => {
    const { created, ctx } = fakeContext();
    createCompressorEngine(ctx, defaults);
    expect(created.delay.delayTime.value).toBe(COMPRESSOR_LOOKAHEAD_SECONDS);
  });

  test("follows an update with ramps, never a jump", () => {
    const { created, ctx } = fakeContext();
    const engine = createCompressorEngine(ctx, defaults);
    const before = created.compressor.ratio.value;
    engine.update({ ...defaults, ratio: 10 });
    expect(created.compressor.ratio.value).toBe(before);
    expect(created.compressor.ratio.targets).toEqual([
      { time: 1.5, timeConstant: 0.01, value: 10 },
    ]);
  });

  test("an update sets the same numbers compressorSettings gives", () => {
    const { created, ctx } = fakeContext();
    const engine = createCompressorEngine(ctx, defaults);
    const state = { ...defaults, autoMakeup: false, makeupDb: 4, mix: 60 };
    engine.update(state);
    const settings = compressorSettings(state);
    expect(created.compressor.threshold.targets[0]?.value).toBe(
      settings.threshold
    );
    expect(created.compressor.release.targets[0]?.value).toBeCloseTo(
      settings.release,
      12
    );
    const gains = created.gains.map((gain) => gain.gain.targets[0]?.value);
    expect(gains).toContainEqual(10 ** (settings.trimDb / 20));
    expect(gains).toContainEqual(settings.wet);
    expect(gains).toContainEqual(settings.dry);
  });

  test("reads the gain reduction off the node", () => {
    const { created, ctx } = fakeContext();
    const engine = createCompressorEngine(ctx, defaults);
    created.compressor.reduction = -7.5;
    expect(engine.reduction).toBe(-7.5);
  });

  test("releases every node it made", () => {
    const { created, ctx } = fakeContext();
    const engine = createCompressorEngine(ctx, defaults);
    engine.dispose();
    for (const node of [created.compressor, created.delay, ...created.gains]) {
      expect(node.disconnected).toBeGreaterThan(0);
    }
  });
});
