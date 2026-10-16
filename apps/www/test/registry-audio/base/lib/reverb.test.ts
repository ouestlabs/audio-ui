import { describe, expect, test } from "bun:test";
import {
  DECAY_DB,
  reverbDecay,
  reverbDevice,
  reverbImpulse,
  reverbSettings,
} from "@/registry-audio/bases/base/lib/reverb-device";
import { createReverbEngine } from "@/registry-audio/bases/base/lib/reverb-engine";

class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
  setValueAtTime(value: number) {
    this.value = value;
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
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
}
class FakeBuffer {
  readonly channels: Float32Array[] = [];
  readonly length: number;
  constructor(length: number) {
    this.length = length;
  }
  copyToChannel(data: Float32Array, channel: number) {
    this.channels[channel] = data;
  }
}
class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
}

function fakeContext() {
  const made = {
    buffers: [] as FakeBuffer[],
    convolvers: [] as FakeConvolver[],
    delay: new FakeDelay(),
    gains: [] as FakeGain[],
  };
  const ctx = {
    createBuffer: (_channels: number, length: number) => {
      const buffer = new FakeBuffer(length);
      made.buffers.push(buffer);
      return buffer;
    },
    createConvolver: () => {
      const convolver = new FakeConvolver();
      made.convolvers.push(convolver);
      return convolver;
    },
    createDelay: () => made.delay,
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    currentTime: 1,
    sampleRate: 8000,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const defaults = reverbDevice.defaults();
const seeded = () => {
  let seed = 7;
  return () => {
    seed = (seed * 16_807) % 2_147_483_647;
    return seed / 2_147_483_647;
  };
};

describe("the reverb device", () => {
  test("its settings are the numbers for the nodes", () => {
    const settings = reverbSettings({ ...defaults, mix: 40, preDelayMs: 50 });
    expect(settings.preDelay).toBe(0.05);
    expect(settings.dry).toBeCloseTo(0.6, 6);
    expect(settings.wet).toBeCloseTo(0.4, 6);
    expect(reverbSettings({ ...defaults, enabled: false }).wet).toBe(0);
  });

  test("the tail is silent until the pre-delay is over, then a line in dB to -60 at the decay", () => {
    const decay = reverbDecay({ ...defaults, decay: 2, preDelayMs: 100 });
    expect(decay(0.05)).toBe(0);
    expect(decay(0.1)).toBeCloseTo(0, 6);
    expect(decay(1.1)).toBeCloseTo(-30, 6);
    expect(decay(2.1)).toBeCloseTo(DECAY_DB, 6);
    expect(decay(8)).toBe(DECAY_DB);
  });

  test("the impulse is as long as the decay and falls to a thousandth by its end", () => {
    const [left, right] = reverbImpulse(
      8000,
      { dampingHz: 20_000, decay: 1 },
      seeded()
    );
    expect(left.length).toBe(8000);
    const rms = (data: Float32Array, from: number, to: number) =>
      Math.sqrt(
        data.slice(from, to).reduce((sum, v) => sum + v * v, 0) / (to - from)
      );
    expect(rms(left, 7600, 8000) / rms(left, 0, 400)).toBeLessThan(0.01);
    // Two channels of different noise: the tail has width.
    expect(left[100]).not.toBe(right[100]);
  });

  test("a closed damping takes the highs out of the tail", () => {
    const energyAbove = (dampingHz: number) => {
      const [data] = reverbImpulse(8000, { dampingHz, decay: 0.5 }, seeded());
      // The first difference is a crude high-pass: how much the signal jumps.
      let sum = 0;
      for (let i = 1; i < data.length; i += 1) {
        sum += ((data[i] ?? 0) - (data[i - 1] ?? 0)) ** 2;
      }
      return sum;
    };
    expect(energyAbove(1000)).toBeLessThan(energyAbove(20_000) / 2);
  });
});

describe("createReverbEngine", () => {
  test("starts with a room loaded and the nodes at the first state", () => {
    const { ctx, made } = fakeContext();
    createReverbEngine(ctx, { ...defaults, decay: 1, mix: 50, preDelayMs: 40 });
    expect(made.convolvers[0]?.buffer?.length).toBe(8000);
    expect(made.delay.delayTime.value).toBe(0.04);
    expect(made.gains.some((gain) => gain.gain.value === 0.5)).toBe(true);
  });

  test("a new decay builds a new room in the idle convolver after a pause, and cross-fades", async () => {
    const { ctx, made } = fakeContext();
    const engine = createReverbEngine(ctx, { ...defaults, decay: 1 });
    const loaded = made.buffers.length;
    engine.update({ ...defaults, decay: 2 });
    expect(made.buffers).toHaveLength(loaded);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(made.buffers).toHaveLength(loaded + 1);
    expect(made.convolvers[1]?.buffer?.length).toBe(16_000);
  });

  test("a knob that does not change the room does not rebuild it", async () => {
    const { ctx, made } = fakeContext();
    const engine = createReverbEngine(ctx, defaults);
    const loaded = made.buffers.length;
    engine.update({ ...defaults, mix: 80 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(made.buffers).toHaveLength(loaded);
  });

  test("dispose lets go of every node and cancels a room still to be built", async () => {
    const { ctx, made } = fakeContext();
    const engine = createReverbEngine(ctx, defaults);
    engine.update({ ...defaults, decay: 3 });
    engine.dispose();
    const loaded = made.buffers.length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(made.buffers).toHaveLength(loaded);
    expect(made.convolvers.every((c) => c.disconnected === 1)).toBe(true);
  });
});
