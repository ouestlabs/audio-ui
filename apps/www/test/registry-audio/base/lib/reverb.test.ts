import { describe, expect, test } from "bun:test";
import {
  DECAY_DB,
  type ReverbType,
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
    expect(highs("room", 1000)).toBeLessThan(highs("room", 20_000) / 2);
  });

  test("the room is the type a reverb starts with", () => {
    expect(defaults.type).toBe("room");
    expect(reverbDevice.sanitize({ decay: 3 }).type).toBe("room");
  });
});

/** How much of the impulse is in its highs, by its first difference: a crude high-pass. */
function highs(type: ReverbType, dampingHz: number) {
  const [data] = reverbImpulse(
    16_000,
    { dampingHz, decay: 0.8, type },
    seeded()
  );
  let jumps = 0;
  let energy = 0;
  for (let i = 1; i < data.length; i += 1) {
    jumps += ((data[i] ?? 0) - (data[i - 1] ?? 0)) ** 2;
    energy += (data[i] ?? 0) ** 2;
  }
  return jumps / energy;
}

/** The decay time an impulse has, by its energy decay from -5 to -35 dB, doubled. */
function decayTime(channels: Float32Array[], sampleRate: number) {
  const length = channels[0]?.length ?? 0;
  const left = new Float64Array(length);
  let sum = 0;
  for (let i = length - 1; i >= 0; i -= 1) {
    for (const channel of channels) {
      sum += (channel[i] ?? 0) ** 2;
    }
    left[i] = sum;
  }
  const db = (i: number) => 10 * Math.log10((left[i] ?? 0) / (left[0] ?? 1));
  const at5 = left.findIndex((_, i) => db(i) <= -5);
  const at35 = left.findIndex((_, i) => db(i) <= -35);
  return (2 * (at35 - at5)) / sampleRate;
}

const TYPES =
  reverbDevice.parameters
    .find((parameter) => parameter.id === "type")
    ?.options?.map((option) => option.value as ReverbType) ?? [];

describe("the reverb's types", () => {
  test("there is a room, a plate, a hall, a spring, a Freeverb and a Schroeder", () => {
    expect(TYPES).toEqual([
      "room",
      "plate",
      "hall",
      "spring",
      "freeverb",
      "schroeder",
    ]);
  });

  for (const type of TYPES) {
    test(`${type}: falls by 60 dB over the decay time`, () => {
      const room = reverbImpulse(
        16_000,
        { dampingHz: 7000, decay: 1.5, type },
        seeded()
      );
      expect(room[0].length).toBe(24_000);
      expect(decayTime(room, 16_000)).toBeGreaterThan(1.5 * 0.85);
      expect(decayTime(room, 16_000)).toBeLessThan(1.5 * 1.15);
    });

    test(`${type}: shorter than it rings by itself, it is brought down to the decay time`, () => {
      const room = reverbImpulse(
        16_000,
        { dampingHz: 7000, decay: 0.3, type },
        seeded()
      );
      expect(decayTime(room, 16_000)).toBeLessThan(0.3 * 1.25);
    });

    test(`${type}: a closed damping takes the highs out of it`, () => {
      expect(highs(type, 1000)).toBeLessThan(highs(type, 20_000) / 2);
    });
  }

  test("a type made by its own algorithm is the same room every time", () => {
    const state = { dampingHz: 5000, decay: 1, type: "plate" as const };
    expect(reverbImpulse(16_000, state)[0]).toEqual(
      reverbImpulse(16_000, state)[0]
    );
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

  test("a new type builds a new room", async () => {
    const { ctx, made } = fakeContext();
    const engine = createReverbEngine(ctx, defaults);
    const loaded = made.buffers.length;
    engine.update({ ...defaults, type: "plate" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(made.buffers).toHaveLength(loaded + 1);
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
