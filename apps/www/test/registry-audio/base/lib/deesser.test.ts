import { describe, expect, test } from "bun:test";
import {
  deesserDevice,
  deesserResponse,
  deesserSettings,
  deesserTable,
} from "@/registry-audio/bases/base/lib/deesser-device";
import { createDeesserEngine } from "@/registry-audio/bases/base/lib/deesser-engine";

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
  readonly Q = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
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

const defaults = deesserDevice.defaults();

describe("the de-esser device", () => {
  test("is a stable, named effect with a ratio and a range", () => {
    expect(deesserDevice.id).toBe("audioui.deesser");
    expect(deesserDevice.kind).toBe("effect");
    expect(
      deesserDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "frequencyHz",
      "thresholdDb",
      "ratio",
      "rangeDb",
      "listen",
    ]);
  });

  test("the range is the least gain the highs can have, and off it is none", () => {
    expect(deesserSettings({ ...defaults, rangeDb: 20 }).floor).toBeCloseTo(
      0.1,
      9
    );
    expect(deesserSettings({ ...defaults, enabled: false }).floor).toBe(1);
  });

  test("listen turns the lows down so the highs are heard alone", () => {
    expect(deesserSettings(defaults).lowGain).toBe(1);
    expect(deesserSettings({ ...defaults, listen: true }).lowGain).toBe(0);
  });

  test("the table follows the gain and never goes under the floor", () => {
    const table = deesserTable(0.25);
    const at = (gain: number) =>
      table[Math.round(((gain + 1) / 2) * (table.length - 1))];
    expect(at(1)).toBeCloseTo(1, 3);
    expect(at(0.5)).toBeCloseTo(0.5, 2);
    expect(at(0.01)).toBeCloseTo(0.25, 6);
  });

  test("at full reduction the lows stay at 0 dB and the highs go down by the range", () => {
    const response = deesserResponse({
      ...defaults,
      frequencyHz: 6000,
      rangeDb: 12,
    });
    expect(response(100)).toBeCloseTo(0, 1);
    expect(response(20_000)).toBeCloseTo(-12, 1);
    expect(deesserResponse({ ...defaults, rangeDb: 0 })(10_000)).toBeCloseTo(
      0,
      6
    );
  });

  test("at the frequency each half is 6 dB down, so the half of the lows and the quarter of the highs add to 4.07 dB under", () => {
    const response = deesserResponse({ ...defaults, rangeDb: 12 });
    expect(response(defaults.frequencyHz)).toBeCloseTo(-4.07, 1);
  });
});

describe("the de-esser engine", () => {
  test("splits with two biquads each way and starts all open without worklets", async () => {
    const { ctx, made } = fakeContext();
    const engine = createDeesserEngine(ctx, defaults);
    expect(made.filters.map((filter) => filter.type)).toEqual([
      "lowpass",
      "lowpass",
      "highpass",
      "highpass",
    ]);
    // The node takes the Q of a low-pass in dB: Butterworth is -3 dB, not 0.707.
    expect(
      made.filters.every((filter) => Math.abs(filter.Q.value + 3.0103) < 0.001)
    ).toBe(true);
    expect(await engine.ready).toBe(false);
    expect(engine.reduction).toBe(0);
  });

  test("follows an update, and rebuilds the table only when the range changes", () => {
    const { ctx, made } = fakeContext();
    const engine = createDeesserEngine(ctx, defaults);
    const first = made.shaper.curve;
    engine.update({ ...defaults, frequencyHz: 8000 });
    expect(made.filters[0]?.frequency.targets.at(-1)).toBe(8000);
    expect(made.shaper.curve).toBe(first);
    engine.update({ ...defaults, rangeDb: 20 });
    expect(made.shaper.curve).not.toBe(first);
    engine.dispose();
    expect(made.filters.every((filter) => filter.disconnected > 0)).toBe(true);
  });
});
