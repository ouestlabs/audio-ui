import { describe, expect, test } from "bun:test";
import {
  channelEqBands,
  channelEqCurve,
  channelEqDevice,
} from "@/registry-audio/bases/base/devices/channel-eq/device";
import { createChannelEqEngine } from "@/registry-audio/bases/base/devices/channel-eq/engine";
import {
  overdriveBand,
  overdriveDevice,
  overdriveSettings,
  overdriveTable,
  TABLE_DOMAIN,
} from "@/registry-audio/bases/base/devices/overdrive/device";
import { createOverdriveEngine } from "@/registry-audio/bases/base/devices/overdrive/engine";
import {
  quantize,
  REDUX_WORKLET,
  reduxCurve,
  reduxDevice,
  reduxSettings,
  reduxTable,
} from "@/registry-audio/bases/base/devices/redux/device";
import { createReduxEngine } from "@/registry-audio/bases/base/devices/redux/engine";

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
  readonly frequency = new FakeParam();
  readonly gain = new FakeParam();
  readonly Q = new FakeParam();
  type = "";
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "";
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
    createDelay: () => ({
      connect: <T>(to: T) => to,
      delayTime: { value: 0 },
      disconnect: () => undefined,
    }),
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

describe("the channel EQ device", () => {
  const defaults = channelEqDevice.defaults();

  test("is flat by default, with the high-pass out of the way", () => {
    const curve = channelEqCurve(defaults);
    // The high-pass "off" is a 10 Hz one: under 0.1 dB at 30 Hz, nothing above.
    for (const hz of [30, 200, 1000, 5000, 15_000]) {
      expect(Math.abs(curve(hz))).toBeLessThan(0.1);
    }
  });

  test("the shelves sit at 100 Hz and 6 kHz, the mid goes where it is told", () => {
    const [highPass, low, mid, high] = channelEqBands({
      ...defaults,
      midHz: 2000,
    });
    // The high-pass is a 0 Hz one while its switch is off: it passes everything.
    expect(highPass?.frequency).toBe(0);
    expect(highPass?.on).toBe(false);
    expect(low?.frequency).toBe(100);
    expect(high?.frequency).toBe(6000);
    expect(mid?.frequency).toBe(2000);
  });

  test("a mid boost is at its gain at its frequency, the switch takes the lows out", () => {
    const boosted = channelEqCurve({ ...defaults, midDb: 6, midHz: 1000 });
    expect(boosted(1000)).toBeCloseTo(6, 0);
    const cut = channelEqCurve({ ...defaults, highPass: true });
    expect(cut(30)).toBeLessThan(-6);
    expect(cut(1000)).toBeCloseTo(0, 1);
  });

  test("off, the curve is flat whatever the knobs say", () => {
    expect(
      channelEqCurve({ ...defaults, enabled: false, midDb: 12 })(1000)
    ).toBe(0);
  });

  test("the engine has four filters and starts at the first state", () => {
    const { ctx, made } = fakeContext();
    createChannelEqEngine(ctx, { ...defaults, midDb: 5, midHz: 3000 });
    expect(made.filters.map((filter) => filter.type)).toEqual([
      "highpass",
      "lowshelf",
      "peaking",
      "highshelf",
    ]);
    expect(made.filters[2]?.frequency.value).toBe(3000);
    expect(made.filters[2]?.gain.value).toBe(5);
  });

  test("an update ramps; off flattens every band", () => {
    const { ctx, made } = fakeContext();
    const engine = createChannelEqEngine(ctx, { ...defaults, lowDb: 6 });
    engine.update({ ...defaults, enabled: false, lowDb: 6 });
    expect(made.filters[1]?.gain.targets.at(-1)).toBe(0);
  });
});

describe("the overdrive device", () => {
  const defaults = overdriveDevice.defaults();

  test("the band peaks at its centre and falls away from it", () => {
    const band = overdriveBand({ ...defaults, bandHz: 1000, width: 2 });
    expect(band(1000)).toBeCloseTo(0, 0);
    expect(band(100)).toBeLessThan(-12);
    expect(band(10_000)).toBeLessThan(-12);
  });

  test("the table is one soft clip and off is the clean sound", () => {
    const table = overdriveTable();
    expect(table).toHaveLength(4096);
    expect(table[0]).toBeCloseTo(Math.tanh(-TABLE_DOMAIN), 6);
    expect(overdriveSettings({ ...defaults, enabled: false })).toMatchObject({
      dry: 1,
      wet: 0,
    });
  });

  test("the engine puts a band-pass before a 4x shaper and ramps its knobs", () => {
    const { ctx, made } = fakeContext();
    const engine = createOverdriveEngine(ctx, defaults);
    expect(made.filters.map((filter) => filter.type)).toEqual([
      "bandpass",
      "lowpass",
    ]);
    expect(made.shaper.oversample).toBe("4x");
    engine.update({ ...defaults, bandHz: 2000 });
    expect(made.filters[0]?.frequency.targets).toEqual([2000]);
  });
});

describe("the redux device", () => {
  const defaults = reduxDevice.defaults();

  test("quantize keeps 2^(bits-1) steps each side and clips at full scale", () => {
    expect(quantize(0.3, 1)).toBe(0);
    expect(quantize(0.6, 1)).toBe(1);
    expect(quantize(0.3, 3)).toBeCloseTo(0.25, 9);
    expect(quantize(5, 8)).toBe(1);
    const levels = new Set(
      Array.from({ length: 2001 }, (_, i) => quantize(i / 1000 - 1, 3))
    );
    expect(levels.size).toBe(9);
  });

  test("the curve is the line at no mix and the stairs at full mix", () => {
    expect(reduxCurve({ ...defaults, mix: 0 })(0.3)).toBeCloseTo(0.3, 9);
    expect(reduxCurve({ ...defaults, bits: 2, mix: 100 })(0.3)).toBeCloseTo(
      0.5,
      9
    );
  });

  test("the table has one entry per step and matches the quantizer", () => {
    const table = reduxTable(4);
    expect(table).toHaveLength(65_537);
    expect(table[0]).toBe(-1);
    expect(table[65_536]).toBe(1);
  });

  test("the sample hold is a worklet that registers one processor", () => {
    expect(REDUX_WORKLET).toContain('registerProcessor("audioui-redux"');
    expect(REDUX_WORKLET).toContain("hold");
  });

  test("with no worklet in the context, the bits still work and ready says false", async () => {
    const { ctx, made } = fakeContext();
    const engine = createReduxEngine(ctx, defaults);
    expect(await engine.ready).toBe(false);
    const first = made.shaper.curve;
    engine.update({ ...defaults, mix: 50 });
    expect(made.shaper.curve).toBe(first);
    engine.update({ ...defaults, bits: 3 });
    expect(made.shaper.curve).not.toBe(first);
    expect(reduxSettings({ ...defaults, enabled: false })).toMatchObject({
      dry: 1,
      wet: 0,
    });
  });
});

describe("the redux's quantizer and its worklet", () => {
  const defaults = reduxDevice.defaults();
  interface Processor {
    port: { onmessage: (event: { data: unknown }) => void };
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ) => boolean;
  }
  const made = (shaped: boolean) => {
    class AudioWorkletProcessor {
      readonly port: { onmessage: (event: { data: unknown }) => void } = {
        onmessage: () => undefined,
      };
    }
    let Made: (new (options: unknown) => Processor) | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      "sampleRate",
      REDUX_WORKLET
    )(
      AudioWorkletProcessor,
      (_name: string, processor: new (options: unknown) => Processor) => {
        Made = processor;
      },
      48_000
    );
    if (!Made) {
      throw new Error("The worklet registered no processor");
    }
    return new Made({ processorOptions: { shaped } });
  };
  const ramp = () => new Float32Array(128).map((_, frame) => frame / 200 - 0.3);
  const parameters = (hold: number, bits: number) => ({
    bits: new Float32Array([bits]),
    hold: new Float32Array([hold]),
  });

  test("its bits are rounded to the nearest level or shaped, the nearest the one it starts with", () => {
    const quantizer = reduxDevice.parameters.find(
      (parameter) => parameter.id === "quantize"
    );
    expect(quantizer?.options?.map((option) => option.value)).toEqual([
      "nearest",
      "shaped",
    ]);
    expect(defaults.quantize).toBe("nearest");
    // A redux saved before the choice plays as it did.
    expect(reduxDevice.sanitize({ bits: 4 }).quantize).toBe("nearest");
    expect(reduxSettings({ ...defaults, quantize: "shaped" }).shaped).toBe(
      true
    );
  });

  test("it holds each sample as the bitcrusher does, at 24 bits", async () => {
    const { default: bitcrusher } = await import("@audio/effect-bitcrusher");
    const input = ramp();
    const output = new Float32Array(128);
    made(false).process([[input]], [[output]], parameters(4, 8));
    const expected = bitcrusher(input.slice(), {
      bits: 24,
      fs: 48_000,
      rate: 1 / 4,
    });
    expect([...output]).toEqual([...expected]);
    // Each held value stands for four samples.
    expect(new Set(output).size).toBeLessThanOrEqual(33);
  });

  test("shaped, it rounds with the noise shaper's error feedback after the hold", async () => {
    const { default: bitcrusher } = await import("@audio/effect-bitcrusher");
    const { default: noiseShaping } = await import("@audio/effect-noiseshaper");
    const input = ramp();
    const output = new Float32Array(128);
    made(true).process([[input]], [[output]], parameters(2, 3));
    const held = bitcrusher(input.slice(), { bits: 24, fs: 48_000, rate: 0.5 });
    expect([...output]).toEqual([...noiseShaping(held, { bits: 3 })]);
  });

  test("a message switches the shaping", () => {
    const processor = made(false);
    processor.port.onmessage({ data: { shaped: true } });
    const output = new Float32Array(128);
    processor.process([[ramp()]], [[output]], parameters(1, 2));
    // Two bits: every sample on one of the levels -1, -0.5, 0, 0.5, 1.
    expect(output.every((sample) => (sample * 2) % 1 === 0)).toBe(true);
  });

  test("with no worklet, a shaped quantizer still rounds through the table", async () => {
    const { ctx, made: nodes } = fakeContext();
    const engine = createReduxEngine(ctx, { ...defaults, quantize: "shaped" });
    expect(await engine.ready).toBe(false);
    expect(nodes.shaper.curve).not.toBeNull();
  });
});
