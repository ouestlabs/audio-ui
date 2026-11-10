import { describe, expect, test } from "bun:test";
import { shifter } from "@audio/spatial-microshift";
import {
  DETUNE_WORKLET,
  midSideDevice,
  midSideSettings,
} from "@/registry-audio/bases/base/devices/mid-side/device";
import { createMidSideEngine } from "@/registry-audio/bases/base/devices/mid-side/engine";

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
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
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
    createDelay: () => new FakeDelay(),
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
  test("is a stable, named effect with a widening, a mid, a side and a bass mono", () => {
    expect(midSideDevice.id).toBe("audioui.mid-side");
    expect(midSideDevice.kind).toBe("effect");
    expect(
      midSideDevice.describe().parameters.map((parameter) => parameter.id)
    ).toEqual([
      "enabled",
      "widen",
      "midDb",
      "sideDb",
      "bassMonoHz",
      "haasMs",
      "detuneCents",
      "detuneMix",
    ]);
    expect(defaults.widen).toBe("off");
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
    ).toMatchObject({ bassHz: 10, mid: 1, side: 1 });
    expect(
      midSideSettings({ ...defaults, enabled: false, widen: "haas" }).widen
    ).toBe("off");
  });

  test("the Haas delay is in seconds and the blend a share", () => {
    expect(
      midSideSettings({ ...defaults, detuneMix: 25, haasMs: 12, widen: "haas" })
    ).toMatchObject({ detuneMix: 0.25, haas: 0.012, widen: "haas" });
  });
});

describe("the mid/side engine's widening", () => {
  // Input, output, as it is, Haas, detuned, widened, then the mid/side gains.
  const PLAIN = 2;
  const HAAS = 3;
  const DETUNED = 4;

  test("Haas plays the delayed path alone", () => {
    const { ctx, made } = fakeContext();
    createMidSideEngine(ctx, { ...defaults, widen: "haas" });
    expect(made.gains[PLAIN]?.gain.value).toBe(0);
    expect(made.gains[HAAS]?.gain.value).toBe(1);
  });

  test("a context with no worklets passes the sound as it is for Detune", async () => {
    const { ctx, made } = fakeContext();
    const engine = createMidSideEngine(ctx, { ...defaults, widen: "detune" });
    expect(await engine.ready).toBe(false);
    expect(made.gains[PLAIN]?.gain.value).toBe(1);
    expect(made.gains[DETUNED]?.gain.value).toBe(0);
  });
});

describe("the detune's worklet", () => {
  const RATE = 48_000;
  const BLOCK = 128;
  const RING = Math.round(RATE * 0.05);
  interface Processor {
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ) => boolean;
  }
  const made = () => {
    class AudioWorkletProcessor {}
    let Made: (new () => Processor) | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      "sampleRate",
      DETUNE_WORKLET
    )(
      AudioWorkletProcessor,
      (_name: string, processor: new () => Processor) => {
        Made = processor;
      },
      RATE
    );
    if (!Made) {
      throw new Error("The worklet registered no processor");
    }
    return new Made();
  };
  const sine = (hz: number, start: number) =>
    new Float32Array(BLOCK).map((_, frame) =>
      Math.sin((2 * Math.PI * hz * (start + frame)) / RATE)
    );
  const parametersOf = (cents: number) => ({
    cents: new Float32Array([cents]),
    mix: new Float32Array([0.5]),
  });
  /** The package's micro-shift of a block, as its own audio node blends it. */
  const blended = (
    shift: (x: number) => number,
    input: Float32Array,
    mix: number
  ) => input.map((x) => x * (1 - mix) + shift(x) * mix);

  test("plays the package's shifters, the left up and the right down", () => {
    const processor = made();
    const up = shifter(9, RING);
    const down = shifter(-9, RING);
    const mix = Math.fround(0.5);
    for (let block = 0; block < 30; block += 1) {
      const left = sine(440, block * BLOCK);
      const right = sine(330, block * BLOCK);
      const outLeft = new Float32Array(BLOCK);
      const outRight = new Float32Array(BLOCK);
      processor.process(
        [[left, right]],
        [[outLeft, outRight]],
        parametersOf(9)
      );
      expect([...outLeft]).toEqual([...blended(up, left, mix)]);
      expect([...outRight]).toEqual([...blended(down, right, mix)]);
    }
  });

  test("a new detune waits for the knob to rest, then fades in on a pair run through the last 50 ms first", () => {
    const processor = made();
    const mix = Math.fround(0.5);
    const history: number[] = [];
    let fresh: ((x: number) => number) | undefined;
    const rest = Math.ceil((0.12 * RATE) / BLOCK);
    const fade = Math.ceil((0.08 * RATE) / BLOCK);
    const old = shifter(9, RING);
    for (let block = 0; block < 40 + rest + fade + 4; block += 1) {
      const input = sine(440, block * BLOCK);
      const output = new Float32Array(BLOCK);
      processor.process(
        [[input, input]],
        [[output, new Float32Array(BLOCK)]],
        parametersOf(block >= 40 ? 20 : 9)
      );
      if (block === 40 + rest) {
        fresh = shifter(20, RING);
        for (const x of history.slice(-RING)) {
          fresh(x);
        }
      }
      const playing = blended(old, input, mix);
      const coming = fresh ? blended(fresh, input, mix) : undefined;
      if (block < 40 + rest) {
        expect([...output]).toEqual([...playing]);
      } else if (block > 40 + rest + fade && coming) {
        expect([...output]).toEqual([...coming]);
      }
      history.push(...input);
    }
    expect(fresh).toBeDefined();
  });

  test("with nothing coming in, it plays out its ring, then stops", () => {
    const processor = made();
    for (let block = 0; block < 40; block += 1) {
      processor.process(
        [[sine(440, block * BLOCK)]],
        [[new Float32Array(BLOCK)]],
        parametersOf(9)
      );
    }
    const after = new Float32Array(BLOCK);
    processor.process([[]], [[after]], parametersOf(9));
    expect(Math.max(...after.map(Math.abs))).toBeGreaterThan(1e-3);
    const later = new Float32Array(BLOCK);
    for (let block = 0; block < 60; block += 1) {
      later.fill(0);
      processor.process([[]], [[later]], parametersOf(9));
    }
    expect(Math.max(...later.map(Math.abs))).toBe(0);
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
