import { describe, expect, test } from "bun:test";
import {
  chorusDevice,
  chorusSettings,
  chorusSweep,
} from "@/registry-audio/bases/base/lib/chorus-device";
import { createChorusEngine } from "@/registry-audio/bases/base/lib/chorus-engine";
import {
  distortionCurve,
  distortionDevice,
  distortionSettings,
  distortionTable,
  softClip,
  TABLE_DOMAIN,
} from "@/registry-audio/bases/base/lib/distortion-device";
import { createDistortionEngine } from "@/registry-audio/bases/base/lib/distortion-engine";

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
  connect<T>(destination: T): T {
    return destination;
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
  type = "";
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "";
}
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
}
class FakeOscillator extends FakeNode {
  readonly frequency = new FakeParam();
  started = 0;
  stopped = 0;
  type = "";
  start() {
    this.started += 1;
  }
  stop() {
    this.stopped += 1;
  }
}

function fakeContext() {
  const made = {
    delay: new FakeDelay(),
    filter: new FakeFilter(),
    gains: [] as FakeGain[],
    oscillator: new FakeOscillator(),
    shaper: new FakeShaper(),
  };
  const ctx = {
    createBiquadFilter: () => made.filter,
    createDelay: () => made.delay,
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    createOscillator: () => made.oscillator,
    createWaveShaper: () => made.shaper,
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

describe("the distortion device", () => {
  const defaults = distortionDevice.defaults();

  test("the soft clip is odd, keeps full scale and flattens as the drive grows", () => {
    expect(softClip(0, 10)).toBe(0);
    expect(softClip(1, 10)).toBeCloseTo(1, 6);
    expect(softClip(-0.5, 10)).toBeCloseTo(-softClip(0.5, 10), 6);
    expect(softClip(0.5, 20)).toBeGreaterThan(softClip(0.5, 2));
  });

  test("the table is the fixed clip over the drive's range", () => {
    const table = distortionTable();
    expect(table[0]).toBeCloseTo(Math.tanh(-TABLE_DOMAIN), 6);
    expect(table.at(-1)).toBeCloseTo(Math.tanh(TABLE_DOMAIN), 6);
  });

  test("a full mix at no drive and unity is close to straight; off is straight", () => {
    const flat = distortionCurve({
      ...defaults,
      driveDb: 0,
      mix: 0,
      outputDb: 0,
    });
    expect(flat(0.4)).toBeCloseTo(0.4, 6);
    const off = distortionCurve({ ...defaults, enabled: false });
    expect(off(0.4)).toBeCloseTo(0.4, 6);
    expect(distortionSettings({ ...defaults, enabled: false }).output).toBe(1);
  });

  test("a hard drive bends the curve above the line for a quiet input", () => {
    const hard = distortionCurve({
      ...defaults,
      driveDb: 30,
      mix: 100,
      outputDb: 0,
    });
    expect(hard(0.1)).toBeGreaterThan(0.8);
  });

  test("the engine oversamples, loads one table and starts at the first state", () => {
    const { ctx, made } = fakeContext();
    createDistortionEngine(ctx, { ...defaults, driveDb: 20, toneHz: 3000 });
    expect(made.shaper.oversample).toBe("4x");
    expect(made.shaper.curve?.length).toBe(4096);
    expect(made.filter.frequency.value).toBe(3000);
    expect(
      made.gains.some((g) => Math.abs(g.gain.value - 10 / TABLE_DOMAIN) < 1e-6)
    ).toBe(true);
  });

  test("an update ramps and never swaps the table", () => {
    const { ctx, made } = fakeContext();
    const engine = createDistortionEngine(ctx, defaults);
    const table = made.shaper.curve;
    engine.update({ ...defaults, driveDb: 30 });
    expect(made.shaper.curve).toBe(table);
    expect(made.filter.frequency.targets).toHaveLength(1);
  });
});

describe("the chorus device", () => {
  const defaults = chorusDevice.defaults();

  test("the sweep stays inside the delay, so the time is never negative", () => {
    const settings = chorusSettings({ ...defaults, delayMs: 5, depth: 100 });
    expect(settings.sweep).toBeLessThan(settings.delay);
  });

  test("the sweep draws the delay up and down around its time at the rate", () => {
    const state = { ...defaults, delayMs: 20, depth: 50, rateHz: 1 };
    const sweep = chorusSweep(state);
    expect(sweep(0)).toBeCloseTo(20, 6);
    expect(sweep(0.25)).toBeCloseTo(24, 6);
    expect(sweep(0.75)).toBeCloseTo(16, 6);
  });

  test("no depth is a fixed delay, off is dry", () => {
    expect(chorusSettings({ ...defaults, depth: 0 }).sweep).toBe(0);
    expect(chorusSettings({ ...defaults, enabled: false }).wet).toBe(0);
  });

  test("the engine starts its oscillator once, ramps updates and stops it on dispose", () => {
    const { ctx, made } = fakeContext();
    const engine = createChorusEngine(ctx, defaults);
    expect(made.oscillator.started).toBe(1);
    engine.update({ ...defaults, rateHz: 3 });
    expect(made.oscillator.frequency.targets).toEqual([3]);
    engine.dispose();
    expect(made.oscillator.stopped).toBe(1);
  });
});
