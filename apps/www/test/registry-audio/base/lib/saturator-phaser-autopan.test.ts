import { describe, expect, test } from "bun:test";
import {
  autoPanDevice,
  autoPanSettings,
  autoPanSweep,
  autoPanWave,
} from "@/registry-audio/bases/base/lib/auto-pan-device";
import { createAutoPanEngine } from "@/registry-audio/bases/base/lib/auto-pan-engine";
import {
  PHASER_STAGES,
  phaserDevice,
  phaserSettings,
  phaserSweep,
} from "@/registry-audio/bases/base/lib/phaser-device";
import { createPhaserEngine } from "@/registry-audio/bases/base/lib/phaser-engine";
import {
  saturate,
  saturatorCurve,
  saturatorDevice,
  saturatorSettings,
  saturatorTable,
} from "@/registry-audio/bases/base/lib/saturator-device";
import { createSaturatorEngine } from "@/registry-audio/bases/base/lib/saturator-engine";

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
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
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
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "";
}
class FakePanner extends FakeNode {
  readonly pan = new FakeParam();
}

function fakeContext() {
  const made = {
    delay: new FakeDelay(),
    filters: [] as FakeFilter[],
    gains: [] as FakeGain[],
    oscillator: new FakeOscillator(),
    panner: new FakePanner(),
    shaper: new FakeShaper(),
  };
  const ctx = {
    createBiquadFilter: () => {
      const filter = new FakeFilter();
      made.filters.push(filter);
      return filter;
    },
    createDelay: () => made.delay,
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    createOscillator: () => made.oscillator,
    createStereoPanner: () => made.panner,
    createWaveShaper: () => made.shaper,
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

describe("the saturator device", () => {
  const defaults = saturatorDevice.defaults();

  test("every curve is odd except the tube, passes zero and stays within full scale", () => {
    for (const curve of ["soft", "hard", "fold", "tube"] as const) {
      expect(Math.abs(saturate(curve, 0))).toBeLessThan(1e-9);
      for (const x of [-1, -0.5, 0.3, 1]) {
        expect(Math.abs(saturate(curve, x))).toBeLessThanOrEqual(1.000_001);
      }
    }
    expect(saturate("soft", -0.4)).toBeCloseTo(-saturate("soft", 0.4), 9);
    expect(saturate("tube", -0.4)).not.toBeCloseTo(-saturate("tube", 0.4), 3);
  });

  test("the hard curve clips, the fold curve comes back down", () => {
    expect(saturate("hard", 0.8)).toBe(1);
    expect(saturate("fold", 0.9)).toBeLessThan(saturate("fold", 0.5));
  });

  test("the transfer curve is the line at no mix, and bends over it with drive", () => {
    const line = saturatorCurve({ ...defaults, mix: 0, outputDb: 0 });
    expect(line(0.3)).toBeCloseTo(0.3, 9);
    const driven = saturatorCurve({
      ...defaults,
      driveDb: 24,
      mix: 100,
      outputDb: 0,
    });
    expect(driven(0.2)).toBeGreaterThan(0.8);
    expect(saturatorSettings({ ...defaults, enabled: false }).output).toBe(1);
  });

  test("the table has one entry per step and matches the curve", () => {
    const table = saturatorTable("soft");
    expect(table).toHaveLength(4096);
    expect(table[0]).toBeCloseTo(saturate("soft", -1), 6);
    expect(table.at(-1)).toBeCloseTo(saturate("soft", 1), 6);
  });

  test("the engine rebuilds its table only when the curve changes", () => {
    const { ctx, made } = fakeContext();
    const engine = createSaturatorEngine(ctx, defaults);
    const first = made.shaper.curve;
    expect(made.shaper.oversample).toBe("4x");
    engine.update({ ...defaults, driveDb: 30 });
    expect(made.shaper.curve).toBe(first);
    engine.update({ ...defaults, curve: "fold" });
    expect(made.shaper.curve).not.toBe(first);
  });
});

describe("the phaser device", () => {
  const defaults = phaserDevice.defaults();

  test("the mode crossfades the two paths, off silences both", () => {
    const phaser = phaserSettings({ ...defaults, mix: 50, mode: "phaser" });
    expect(phaser).toMatchObject({ flangerWet: 0, phaserWet: 0.5 });
    const flanger = phaserSettings({ ...defaults, mix: 50, mode: "flanger" });
    expect(flanger).toMatchObject({ flangerWet: 0.5, phaserWet: 0 });
    expect(phaserSettings({ ...defaults, enabled: false }).dry).toBe(1);
  });

  test("the flanger's sweep stays inside its delay, the phaser's is cents", () => {
    const settings = phaserSettings({ ...defaults, delayMs: 0.5, depth: 100 });
    expect(settings.flangerSweep).toBeLessThan(settings.delay);
    expect(phaserSettings({ ...defaults, depth: 100 }).phaserSweepCents).toBe(
      1800
    );
    expect(phaserSettings({ ...defaults, depth: 0 }).phaserSweepCents).toBe(0);
  });

  test("the sweep is the oscillator at the depth", () => {
    const sweep = phaserSweep({ ...defaults, depth: 80, rateHz: 1 });
    expect(sweep(0)).toBeCloseTo(0, 9);
    expect(sweep(0.25)).toBeCloseTo(80, 9);
  });

  test("the engine has four all-pass stages on one oscillator that starts once and stops on dispose", () => {
    const { ctx, made } = fakeContext();
    const engine = createPhaserEngine(ctx, defaults);
    expect(made.filters).toHaveLength(PHASER_STAGES);
    expect(made.filters.every((filter) => filter.type === "allpass")).toBe(
      true
    );
    expect(made.oscillator.started).toBe(1);
    engine.update({ ...defaults, centerHz: 2000 });
    expect(made.filters.every((f) => f.frequency.targets.at(-1) === 2000)).toBe(
      true
    );
    engine.dispose();
    expect(made.oscillator.stopped).toBe(1);
  });
});

describe("the auto pan device", () => {
  const defaults = autoPanDevice.defaults();

  test("the waves swing from -1 to 1 at the right phases", () => {
    expect(autoPanWave("sine", 0.25)).toBeCloseTo(1, 9);
    expect(autoPanWave("triangle", 0)).toBe(-1);
    expect(autoPanWave("triangle", 0.5)).toBe(1);
    expect(autoPanWave("square", 0.25)).toBe(1);
    expect(autoPanWave("square", 0.75)).toBe(-1);
  });

  test("pan moves the pan by the depth, tremolo the level by half of it around its middle", () => {
    const pan = autoPanSettings({ ...defaults, depth: 80, mode: "pan" });
    expect(pan).toMatchObject({
      panDepth: 0.8,
      tremoloBase: 1,
      tremoloDepth: 0,
    });
    const tremolo = autoPanSettings({
      ...defaults,
      depth: 80,
      mode: "tremolo",
    });
    expect(tremolo.panDepth).toBe(0);
    expect(tremolo.tremoloBase).toBeCloseTo(0.6, 9);
    expect(tremolo.tremoloDepth).toBeCloseTo(0.4, 9);
    // The level swings between base - depth and base + depth: 0.2 to 1.
    expect(tremolo.tremoloBase + tremolo.tremoloDepth).toBeCloseTo(1, 9);
  });

  test("off, nothing moves", () => {
    expect(autoPanSettings({ ...defaults, enabled: false })).toMatchObject({
      panDepth: 0,
      tremoloDepth: 0,
    });
  });

  test("the engine takes the waveform of the state and ramps the rest", () => {
    const { ctx, made } = fakeContext();
    const engine = createAutoPanEngine(ctx, defaults);
    expect(made.oscillator.type).toBe("sine");
    engine.update({ ...defaults, rateHz: 5, shape: "square" });
    expect(made.oscillator.type).toBe("square");
    expect(made.oscillator.frequency.targets).toEqual([5]);
    expect(
      autoPanSweep({ ...defaults, depth: 50, rateHz: 1, shape: "sine" })(0.25)
    ).toBeCloseTo(50, 9);
  });
});
