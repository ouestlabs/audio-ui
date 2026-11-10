import { describe, expect, test } from "bun:test";
import {
  TRANSIENT_WORKLET,
  transientDevice,
  transientSettings,
} from "@/registry-audio/bases/base/devices/transient/device";
import { createTransientEngine } from "@/registry-audio/bases/base/devices/transient/engine";

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

const defaults = transientDevice.defaults();

describe("the transient shaper device", () => {
  test("is a stable, named effect with an attack, a sustain and an output", () => {
    expect(transientDevice.id).toBe("audioui.transient");
    expect(transientDevice.kind).toBe("effect");
    expect(
      transientDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual(["enabled", "attackDb", "sustainDb", "outputDb"]);
  });

  test("the numbers are the gains the shaper adds, and the output as a gain", () => {
    const { modelParams } = transientSettings({
      ...defaults,
      attackDb: 8,
      sustainDb: -4,
    });
    expect(modelParams.attackGain).toBeCloseTo(10 ** (8 / 20) - 1, 6);
    expect(modelParams.sustainGain).toBeCloseTo(10 ** (-4 / 20) - 1, 6);
    expect(transientSettings({ ...defaults, outputDb: 6 }).output).toBeCloseTo(
      1.995,
      3
    );
  });

  test("off, there is no shaping and the output is unity", () => {
    expect(
      transientSettings({
        ...defaults,
        attackDb: 9,
        enabled: false,
        outputDb: 6,
      })
    ).toEqual({ modelParams: { attackGain: 0, sustainGain: 0 }, output: 1 });
  });

  test("the worklet source is the processor the engine makes", () => {
    expect(TRANSIENT_WORKLET).toContain(
      'registerProcessor("audioui-transient"'
    );
  });
});

describe("the transient shaper engine", () => {
  test("passes the audio until the shaper is ready", async () => {
    const { ctx, made } = fakeContext();
    const engine = createTransientEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    expect(made.gains.some((gain) => gain.gain.value === 1)).toBe(true);
  });

  test("an update ramps the output and dispose lets go", () => {
    const { ctx, made } = fakeContext();
    const engine = createTransientEngine(ctx, defaults);
    engine.update({ ...defaults, outputDb: 6 });
    expect(made.gains.flatMap((gain) => gain.gain.targets)).toContainEqual(
      10 ** (6 / 20)
    );
    engine.dispose();
    expect(made.gains.every((gain) => gain.disconnected > 0)).toBe(true);
  });
});
