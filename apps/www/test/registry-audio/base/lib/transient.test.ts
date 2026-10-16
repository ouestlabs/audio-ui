import { describe, expect, test } from "bun:test";
import {
  LOOKAHEAD_SECONDS,
  TRANSIENT_WORKLET,
  transientDevice,
  transientSettings,
} from "@/registry-audio/bases/base/lib/transient-device";
import { createTransientEngine } from "@/registry-audio/bases/base/lib/transient-engine";

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
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
}

function fakeContext() {
  const made = { delay: new FakeDelay(), gains: [] as FakeGain[] };
  const ctx = {
    createDelay: () => made.delay,
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

  test("the numbers are the amounts in dB and the output as a gain", () => {
    expect(
      transientSettings({
        ...defaults,
        attackDb: 8,
        outputDb: 6,
        sustainDb: -4,
      })
    ).toMatchObject({ attack: 8, sustain: -4 });
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
    ).toEqual({ attack: 0, output: 1, sustain: 0 });
  });

  test("the audio waits a millisecond for the detector, on or off", () => {
    expect(transientDevice.latency(defaults, 48_000)).toBe(LOOKAHEAD_SECONDS);
    expect(
      transientDevice.latency({ ...defaults, enabled: false }, 48_000)
    ).toBe(LOOKAHEAD_SECONDS);
    expect(LOOKAHEAD_SECONDS).toBe(0.001);
  });

  test("the detector source is a processor with the two amounts the engine sets", () => {
    expect(TRANSIENT_WORKLET).toContain(
      'registerProcessor("audioui-transient"'
    );
    expect(TRANSIENT_WORKLET).toContain('name: "attack"');
    expect(TRANSIENT_WORKLET).toContain('name: "sustain"');
  });
});

describe("the transient shaper engine", () => {
  test("delays the audio by the look-ahead and passes it until the detector is ready", async () => {
    const { ctx, made } = fakeContext();
    const engine = createTransientEngine(ctx, defaults);
    expect(made.delay.delayTime.value).toBe(LOOKAHEAD_SECONDS);
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
    expect(made.delay.disconnected).toBeGreaterThan(0);
  });
});
