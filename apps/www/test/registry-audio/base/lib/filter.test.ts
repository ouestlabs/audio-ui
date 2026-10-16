import { describe, expect, test } from "bun:test";
import {
  FLAT_Q,
  filterCurve,
  filterDevice,
  filterSettings,
  resonanceDb,
  resonanceFromDb,
} from "@/registry-audio/bases/base/lib/filter-device";
import { createFilterEngine } from "@/registry-audio/bases/base/lib/filter-engine";

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
  readonly Q = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}

function fakeContext() {
  const made = { filter: new FakeFilter(), gains: [] as FakeGain[] };
  const ctx = {
    createBiquadFilter: () => made.filter,
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const defaults = filterDevice.defaults();

describe("the filter device", () => {
  test("each type is the node's own type", () => {
    const types = (["lowpass", "highpass", "bandpass", "notch"] as const).map(
      (type) => filterSettings({ ...defaults, type }).type
    );
    expect(types).toEqual(["lowpass", "highpass", "bandpass", "notch"]);
  });

  test("a low-pass and a high-pass read the resonance in decibels, the others linear", () => {
    const q = (type: "highpass" | "lowpass" | "notch", resonance: number) =>
      filterSettings({ ...defaults, resonance, type }).q;
    expect(q("lowpass", 2)).toBeCloseTo(20 * Math.log10(2), 6);
    expect(q("highpass", 2)).toBeCloseTo(20 * Math.log10(2), 6);
    expect(q("notch", 2)).toBe(2);
  });

  test("off, the signal goes round the node", () => {
    expect(filterSettings({ ...defaults, enabled: false })).toMatchObject({
      dry: 1,
      wet: 0,
    });
    expect(filterCurve({ ...defaults, enabled: false })(500)).toBe(0);
  });

  test("a low-pass passes the lows and takes the highs, a high-pass the other way", () => {
    const low = filterCurve({ ...defaults, cutoffHz: 1000, type: "lowpass" });
    const high = filterCurve({ ...defaults, cutoffHz: 1000, type: "highpass" });
    expect(low(100)).toBeCloseTo(0, 0);
    expect(low(10_000)).toBeLessThan(-30);
    expect(high(100)).toBeLessThan(-30);
    expect(high(10_000)).toBeCloseTo(0, 0);
  });

  test("a notch takes the cutoff out, and a band-pass keeps only it", () => {
    const notch = filterCurve({
      ...defaults,
      cutoffHz: 1000,
      resonance: 4,
      type: "notch",
    });
    const band = filterCurve({
      ...defaults,
      cutoffHz: 1000,
      resonance: 4,
      type: "bandpass",
    });
    expect(notch(1000)).toBeLessThan(-30);
    expect(notch(100)).toBeCloseTo(0, 0);
    expect(band(1000)).toBeCloseTo(0, 0);
    expect(band(100)).toBeLessThan(-12);
  });

  test("the resonance and its height in dB are each other's inverse, flat at zero", () => {
    expect(resonanceDb(FLAT_Q)).toBeCloseTo(0, 6);
    expect(resonanceFromDb(resonanceDb(5))).toBeCloseTo(5, 6);
    expect(resonanceFromDb(6)).toBeCloseTo(FLAT_Q * 1.995, 2);
  });

  test("a type that is not one of the four is refused by name", () => {
    const applied = filterDevice.apply(defaults, { type: "comb" });
    expect(applied.rejected).toEqual([
      { id: "type", reason: "not one of the options" },
    ]);
  });
});

describe("createFilterEngine", () => {
  test("starts the node at the first state", () => {
    const { ctx, made } = fakeContext();
    createFilterEngine(ctx, { ...defaults, cutoffHz: 800, type: "highpass" });
    expect(made.filter.type).toBe("highpass");
    expect(made.filter.frequency.value).toBe(800);
  });

  test("an update changes the type and ramps the rest", () => {
    const { ctx, made } = fakeContext();
    const engine = createFilterEngine(ctx, defaults);
    engine.update({ ...defaults, cutoffHz: 3000, type: "notch" });
    expect(made.filter.type).toBe("notch");
    expect(made.filter.frequency.targets).toEqual([3000]);
  });

  test("off, the filtered path is silent and the dry one open", () => {
    const { ctx, made } = fakeContext();
    const engine = createFilterEngine(ctx, defaults);
    engine.update({ ...defaults, enabled: false });
    const targets = made.gains.flatMap((gain) => gain.gain.targets);
    expect(targets.sort()).toEqual([0, 1]);
  });

  test("dispose lets go of every node", () => {
    const { ctx, made } = fakeContext();
    createFilterEngine(ctx, defaults).dispose();
    expect(made.filter.disconnected).toBe(1);
    expect(made.gains.every((gain) => gain.disconnected === 1)).toBe(true);
  });
});
