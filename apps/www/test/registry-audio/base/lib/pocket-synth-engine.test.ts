import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  pocketSynthCutoff,
  pocketSynthDevice,
  pocketSynthPitch,
} from "@/registry-audio/bases/base/lib/pocket-synth-device";
import { createPocketSynthEngine } from "@/registry-audio/bases/base/lib/pocket-synth-engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { value: number }[] = [];
  readonly ramps: { time: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ time, value });
    return this;
  }
  setTargetAtTime(value: number) {
    this.targets.push({ value });
    return this;
  }
  setValueAtTime(value: number, time: number) {
    this.sets.push({ time, value });
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
  type = "";
}
class FakeOscillator extends FakeNode {
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  started = 0;
  stopped: number[] = [];
  type = "";
  start() {
    this.started += 1;
  }
  stop(when?: number) {
    this.stopped.push(when ?? 0);
  }
}

function fakeContext() {
  const created = {
    filters: [] as FakeFilter[],
    gains: [] as FakeGain[],
    oscillators: [] as FakeOscillator[],
  };
  const make = <T>(list: T[], item: T) => {
    list.push(item);
    return item;
  };
  const ctx = {
    createBiquadFilter: () => make(created.filters, new FakeFilter()),
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    currentTime: 2,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = pocketSynthDevice.defaults();
const NOTE = { cutoff: 1000, frequency: 220 };

describe("createPocketSynthEngine", () => {
  test("starts the output at the state's volume", () => {
    const { created, ctx } = fakeContext();
    createPocketSynthEngine(ctx, { ...defaults, volume: 1 });
    expect(created.gains[0]?.gain.value).toBeCloseTo(0.3, 6);
  });

  test("a note starts one voice with the state's wave and filter", () => {
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, {
      ...defaults,
      filter: "lowpass",
      wave: "sawtooth",
    });
    engine.noteOn(NOTE);
    const [oscillator] = created.oscillators;
    const [filter] = created.filters;
    expect(oscillator?.type).toBe("sawtooth");
    expect(oscillator?.frequency.sets[0]?.value).toBe(220);
    expect(oscillator?.started).toBe(1);
    expect(filter?.type).toBe("lowpass");
    expect(filter?.frequency.sets[0]?.value).toBe(1000);
  });

  test("a note while one is held glides it, with no second voice", () => {
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.noteOn({ cutoff: 4000, frequency: 440 });
    expect(created.oscillators).toHaveLength(1);
    expect(created.oscillators[0]?.frequency.targets[0]?.value).toBe(440);
    expect(created.filters[0]?.frequency.targets[0]?.value).toBe(4000);
  });

  test("a note off releases the voice, and the next note is a new one", () => {
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.noteOff();
    const [first] = created.oscillators;
    expect(first?.stopped).toHaveLength(1);
    expect(first?.stopped[0]).toBeGreaterThan(2);
    engine.noteOn(NOTE);
    expect(created.oscillators).toHaveLength(2);
  });

  test("a note off with none held does nothing", () => {
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, defaults);
    engine.noteOff();
    expect(created.oscillators).toHaveLength(0);
  });

  test("a voice lets go of its nodes when it ends", () => {
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    created.oscillators[0]?.onended?.();
    expect(created.oscillators[0]?.disconnected).toBe(1);
    expect(created.filters[0]?.disconnected).toBe(1);
  });

  test("a new state moves the volume and changes the held voice", () => {
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.update({
      ...defaults,
      filter: "highpass",
      volume: 0.2,
      wave: "sine",
    });
    expect(created.gains[0]?.gain.targets[0]?.value).toBeCloseTo(0.06, 6);
    expect(created.oscillators[0]?.type).toBe("sine");
    expect(created.filters[0]?.type).toBe("highpass");
  });

  test("dispose stops the held voice", () => {
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.dispose();
    expect(created.oscillators[0]?.stopped).toHaveLength(1);
    expect(created.gains[0]?.disconnected).toBe(1);
  });
});

describe("the pocket synth device", () => {
  test("is an instrument with a waveform, a filter and a volume", () => {
    expect(pocketSynthDevice.kind).toBe("instrument");
    expect(
      pocketSynthDevice.parameters.map((parameter) => parameter.id)
    ).toEqual(["wave", "filter", "volume"]);
  });

  test("a pad position plays a pitch and a cutoff on log axes", () => {
    expect(pocketSynthPitch(0)).toBeCloseTo(30, 6);
    expect(pocketSynthPitch(1)).toBeCloseTo(1046, 6);
    expect(pocketSynthCutoff(0)).toBeCloseTo(200, 6);
    expect(pocketSynthCutoff(1)).toBeCloseTo(8000, 6);
    // Halfway along a log axis is the geometric mean.
    expect(pocketSynthPitch(0.5)).toBeCloseTo(Math.sqrt(30 * 1046), 6);
  });

  test("a model's value that is not a waveform is refused by name", () => {
    const applied = pocketSynthDevice.apply(pocketSynthDevice.defaults(), {
      wave: "noise",
    });
    expect(applied.rejected).toEqual([
      { id: "wave", reason: "not one of the options" },
    ]);
  });
});

describe("an agent playing the pocket synth", () => {
  const [, , play] = deviceTools(pocketSynthDevice);

  test("the play tool is there and gives a note the engine takes", () => {
    expect(play?.name).toBe("audioui_pocket_synth_play");
    const result = play?.run(pocketSynthDevice.defaults(), {
      cutoff: 3000,
      frequency: 440,
    });
    expect(result?.note).toEqual({ cutoff: 3000, frequency: 440 });
    const { created, ctx } = fakeContext();
    const engine = createPocketSynthEngine(ctx, pocketSynthDevice.defaults());
    engine.noteOn(result?.note as { cutoff: number; frequency: number });
    expect(created.oscillators[0]?.frequency.sets[0]?.value).toBe(440);
    expect(created.filters[0]?.frequency.sets[0]?.value).toBe(3000);
  });

  test("a pitch beyond the instrument is brought in, not played", () => {
    const result = play?.run(pocketSynthDevice.defaults(), {
      frequency: 20_000,
    });
    expect(result?.note?.frequency).toBe(1046);
  });
});
