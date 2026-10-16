import { describe, expect, test } from "bun:test";
import {
  midSideDevice,
  midSideSettings,
} from "@/registry-audio/bases/base/lib/mid-side-device";
import { createMidSideEngine } from "@/registry-audio/bases/base/lib/mid-side-engine";

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
  channelCount = 0;
  channelCountMode = "";
  channelInterpretation = "";
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
    createChannelMerger: () => new FakeNode(),
    createChannelSplitter: () => new FakeNode(),
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const defaults = midSideDevice.defaults();

describe("the mid/side device", () => {
  test("is a stable, named effect with a mid, a side and a bass mono", () => {
    expect(midSideDevice.id).toBe("audioui.mid-side");
    expect(midSideDevice.kind).toBe("effect");
    expect(
      midSideDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual(["enabled", "midDb", "sideDb", "bassMonoHz"]);
  });

  test("the levels are gains and bass mono is a high-pass cutoff", () => {
    expect(
      midSideSettings({ ...defaults, bassMonoHz: 120, midDb: -6, sideDb: 6 })
    ).toMatchObject({ bassHz: 120 });
    expect(midSideSettings({ ...defaults, midDb: -6 }).mid).toBeCloseTo(
      0.501,
      3
    );
    expect(midSideSettings({ ...defaults, sideDb: 6 }).side).toBeCloseTo(
      1.995,
      3
    );
  });

  test("with bass mono at 0 the high-pass is under hearing and passes everything, and it reads Off", () => {
    expect(midSideSettings(defaults).bassHz).toBe(10);
    expect(midSideDevice.format("bassMonoHz", 0)).toBe("Off");
    expect(midSideDevice.format("bassMonoHz", 150)).not.toBe("Off");
  });

  test("off, both levels are unity and the side keeps its lows", () => {
    expect(
      midSideSettings({
        ...defaults,
        bassMonoHz: 300,
        enabled: false,
        midDb: 9,
        sideDb: -12,
      })
    ).toEqual({ bassHz: 10, mid: 1, side: 1 });
  });
});

describe("the mid/side engine", () => {
  test("is a Butterworth high-pass on the side, in dB for the node", () => {
    const { ctx, made } = fakeContext();
    createMidSideEngine(ctx, defaults);
    expect(made.filter.type).toBe("highpass");
    expect(made.filter.Q.value).toBeCloseTo(-3.0103, 3);
  });

  test("follows an update with ramps, and lets go of every node", () => {
    const { ctx, made } = fakeContext();
    const engine = createMidSideEngine(ctx, defaults);
    engine.update({ ...defaults, bassMonoHz: 200, midDb: -6, sideDb: 6 });
    expect(made.filter.frequency.targets).toContain(200);
    const targets = made.gains.flatMap((gain) => gain.gain.targets);
    expect(targets.some((value) => Math.abs(value - 1.995) < 0.01)).toBe(true);
    engine.dispose();
    expect(made.filter.disconnected).toBeGreaterThan(0);
  });
});
