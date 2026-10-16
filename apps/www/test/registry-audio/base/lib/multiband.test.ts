import { describe, expect, test } from "bun:test";
import {
  multibandBands,
  multibandDevice,
  multibandSettings,
} from "@/registry-audio/bases/base/lib/multiband-device";
import { createMultibandEngine } from "@/registry-audio/bases/base/lib/multiband-engine";

class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
}
class FakeNode {
  connections = 0;
  disconnected = 0;
  connect<T>(to: T): T {
    this.connections += 1;
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
  readonly Q = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}

function fakeContext() {
  const made = { filters: [] as FakeFilter[], gains: [] as FakeGain[] };
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
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const defaults = multibandDevice.defaults();

describe("the multiband compressor device", () => {
  test("is a stable, named effect with a threshold and a ratio for each band", () => {
    expect(multibandDevice.id).toBe("audioui.multiband");
    expect(multibandDevice.kind).toBe("effect");
    expect(
      multibandDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "lowHz",
      "highHz",
      "lowThresholdDb",
      "lowRatio",
      "midThresholdDb",
      "midRatio",
      "highThresholdDb",
      "highRatio",
      "attackMs",
      "releaseMs",
      "outputDb",
    ]);
  });

  test("the two splits can never cross: their ranges do not overlap", () => {
    const [low, high] = ["lowHz", "highHz"].map((id) =>
      multibandDevice
        .describe()
        .parameters.find((parameter) => parameter.id === id)
    );
    expect((low as { max: number }).max).toBeLessThan(
      (high as { min: number }).min
    );
  });

  test("each band has its own numbers, shared timing in seconds", () => {
    const settings = multibandSettings({
      ...defaults,
      attackMs: 20,
      highRatio: 8,
      lowThresholdDb: -30,
      releaseMs: 200,
    });
    expect(settings.bands[0]).toMatchObject({
      attack: 0.02,
      release: 0.2,
      threshold: -30,
    });
    expect(settings.bands[2]?.ratio).toBe(8);
    expect(settings.bands[1]?.ratio).toBe(defaults.midRatio);
  });

  test("off, every ratio is 1 and the output is unity", () => {
    const off = multibandSettings({ ...defaults, enabled: false, outputDb: 6 });
    expect(off.bands.every((band) => band.ratio === 1)).toBe(true);
    expect(off.output).toBe(1);
  });

  test("the three bands add back to the signal: their gains sum to 1 at every frequency", () => {
    const bands = multibandBands(defaults);
    for (const hz of [30, 100, 200, 700, 3000, 8000, 16_000]) {
      const sum = ["low", "mid", "high"]
        .map((band) => 10 ** (bands[band as "low"](hz) / 20))
        .reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });
});

describe("the multiband engine", () => {
  test("builds six pairs of biquads and passes the bands until the detectors are ready", async () => {
    const { ctx, made } = fakeContext();
    const engine = createMultibandEngine(ctx, defaults);
    expect(made.filters).toHaveLength(12);
    // The node takes the Q of a low-pass in dB: Butterworth is -3 dB.
    expect(
      made.filters.every((filter) => Math.abs(filter.Q.value + 3.0103) < 0.001)
    ).toBe(true);
    expect(await engine.ready).toBe(false);
    expect(engine.reductions).toEqual({ high: 0, low: 0, mid: 0 });
  });

  test("an update moves the splits and the output, and dispose lets go", () => {
    const { ctx, made } = fakeContext();
    const engine = createMultibandEngine(ctx, defaults);
    engine.update({ ...defaults, highHz: 6000, lowHz: 400, outputDb: 6 });
    const targets = made.filters.flatMap((filter) => filter.frequency.targets);
    expect(targets).toContain(400);
    expect(targets).toContain(6000);
    expect(made.gains.flatMap((gain) => gain.gain.targets)).toContainEqual(
      10 ** (6 / 20)
    );
    engine.dispose();
    expect(made.filters.every((filter) => filter.disconnected > 0)).toBe(true);
  });
});
