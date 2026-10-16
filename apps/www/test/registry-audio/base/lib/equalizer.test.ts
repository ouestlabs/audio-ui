import { describe, expect, test } from "bun:test";
import {
  EQUALIZER_BANDS,
  equalizerBands,
  equalizerCurve,
  equalizerDevice,
} from "@/registry-audio/bases/base/lib/equalizer-device";
import { createEqualizerEngine } from "@/registry-audio/bases/base/lib/equalizer-engine";

class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
}

class FakeNode {
  readonly connections: unknown[] = [];
  disconnected = 0;
  connect<T>(destination: T): T {
    this.connections.push(destination);
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
  readonly gain = new FakeParam();
  type = "";
}

function fakeContext() {
  const created = { filters: [] as FakeFilter[], gains: [] as FakeGain[] };
  const ctx = {
    createBiquadFilter: () => {
      const filter = new FakeFilter();
      created.filters.push(filter);
      return filter;
    },
    createGain: () => {
      const gain = new FakeGain();
      created.gains.push(gain);
      return gain;
    },
    currentTime: 1,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = equalizerDevice.defaults();
const shaped = equalizerDevice.apply(defaults, {
  highDb: 6,
  lowDb: -4,
  lowMidDb: 5,
  lowMidQ: 2,
  outputDb: -2,
}).state;

describe("the equalizer device", () => {
  test("is flat by default", () => {
    const curve = equalizerCurve(defaults);
    for (const hz of [30, 200, 1000, 5000, 15_000]) {
      expect(curve(hz)).toBeCloseTo(0, 6);
    }
  });

  test("its bands are a low shelf, two bells and a high shelf, from its state", () => {
    expect(EQUALIZER_BANDS.map((band) => band.type)).toEqual([
      "lowshelf",
      "peak",
      "peak",
      "highshelf",
    ]);
    const bands = equalizerBands(shaped);
    expect(bands[0]).toMatchObject({ frequency: 100, gainDb: -4 });
    expect(bands[1]).toMatchObject({ frequency: 400, gainDb: 5, q: 2 });
    expect(bands[3]).toMatchObject({ frequency: 8000, gainDb: 6 });
  });

  test("a bell is at its gain at its own frequency, and the trim adds to the curve", () => {
    const bell = equalizerDevice.apply(defaults, {
      lowMidDb: 6,
      lowMidHz: 1000,
    }).state;
    expect(equalizerCurve(bell)(1000)).toBeCloseTo(6, 1);
    expect(equalizerCurve({ ...bell, outputDb: -3 })(1000)).toBeCloseTo(3, 1);
  });

  test("off, the curve is flat whatever the bands say", () => {
    const curve = equalizerCurve({ ...shaped, enabled: false });
    expect(curve(400)).toBe(0);
    expect(curve(8000)).toBe(0);
  });

  test("a model's gain beyond 18 dB is brought in and marked", () => {
    const applied = equalizerDevice.apply(defaults, { lowDb: 40 });
    expect(applied.state.lowDb).toBe(18);
    expect(applied.changes[0]?.adjusted).toBe(true);
  });
});

describe("createEqualizerEngine", () => {
  test("chains the filters in series with the right types", () => {
    const { created, ctx } = fakeContext();
    createEqualizerEngine(ctx, shaped);
    expect(created.filters.map((filter) => filter.type)).toEqual([
      "lowshelf",
      "peaking",
      "peaking",
      "highshelf",
    ]);
    const [input, trim, output] = [
      created.gains[1],
      created.gains[2],
      created.gains[0],
    ];
    expect(input).toBeDefined();
    expect(trim).toBeDefined();
    expect(output).toBeDefined();
    expect(created.filters[0]?.connections).toEqual([created.filters[1]]);
    expect(created.filters[3]?.connections).toEqual([trim]);
  });

  test("starts the nodes at the first state, not at their own defaults", () => {
    const { created, ctx } = fakeContext();
    createEqualizerEngine(ctx, shaped);
    expect(created.filters[1]?.frequency.value).toBe(400);
    expect(created.filters[1]?.gain.value).toBe(5);
    expect(created.filters[1]?.Q.value).toBe(2);
    expect(created.filters[3]?.gain.value).toBe(6);
  });

  test("an update moves the parameters with a ramp, never a jump", () => {
    const { created, ctx } = fakeContext();
    const engine = createEqualizerEngine(ctx, defaults);
    engine.update(shaped);
    expect(created.filters[1]?.gain.targets).toEqual([5]);
    expect(created.filters[0]?.gain.targets).toEqual([-4]);
  });

  test("off, the bands go flat and the trim to unity", () => {
    const { created, ctx } = fakeContext();
    const engine = createEqualizerEngine(ctx, shaped);
    engine.update({ ...shaped, enabled: false });
    for (const filter of created.filters) {
      expect(filter.gain.targets.at(-1)).toBe(0);
    }
    expect(created.gains[2]?.gain.targets.at(-1)).toBe(1);
  });

  test("dispose lets go of every node", () => {
    const { created, ctx } = fakeContext();
    const engine = createEqualizerEngine(ctx, defaults);
    engine.dispose();
    expect(created.filters.every((filter) => filter.disconnected === 1)).toBe(
      true
    );
    expect(created.gains.every((gain) => gain.disconnected === 1)).toBe(true);
  });
});
