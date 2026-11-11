import { describe, expect, test } from "bun:test";
import {
  deesserDevice,
  deesserResponse,
  deesserSettings,
} from "@/registry-audio/bases/base/devices/deesser/device";
import { createDeesserEngine } from "@/registry-audio/bases/base/devices/deesser/engine";

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
function fakeContext() {
  const made = { gains: [] as FakeGain[] };
  const ctx = {
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
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
      "model",
      "frequencyHz",
      "q",
      "overBodyDb",
      "ratio",
      "rangeDb",
    ]);
  });

  test("the range goes on the worklet as a cut, and off it is none", () => {
    expect(
      deesserSettings({ ...defaults, rangeDb: 20 }).modelParams.range
    ).toBe(-20);
    expect(
      deesserSettings({ ...defaults, enabled: false }).modelParams.range
    ).toBe(0);
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
  test("passes the highs without worklets and reads no reduction", async () => {
    const { ctx } = fakeContext();
    const engine = createDeesserEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    expect(engine.reduction).toBe(0);
  });

  test("follows an update and dispose lets go", () => {
    const { ctx, made } = fakeContext();
    const engine = createDeesserEngine(ctx, defaults);
    engine.update({ ...defaults, frequencyHz: 8000 });
    engine.dispose();
    expect(made.gains.every((gain) => gain.disconnected > 0)).toBe(true);
  });
});
