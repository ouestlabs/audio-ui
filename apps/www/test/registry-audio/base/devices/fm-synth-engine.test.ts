import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/engine/device";
import {
  attackSeconds,
  FM_ALGORITHMS,
  FM_SYNTH_PRESETS,
  fmAlgorithm,
  fmSynthDevice,
  fmSynthPreset,
  ratioOf,
  releaseSeconds,
} from "@/registry-audio/bases/base/devices/fm-synth/device";
import { createFmSynthEngine } from "@/registry-audio/bases/base/devices/fm-synth/engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { time: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  setTargetAtTime(value: number, time: number) {
    this.targets.push({ time, value });
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
class FakeOscillator extends FakeNode {
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  started: number[] = [];
  stopped: number[] = [];
  waves = 0;
  setPeriodicWave() {
    this.waves += 1;
  }
  start(when?: number) {
    this.started.push(when ?? 0);
  }
  stop(when?: number) {
    this.stopped.push(when ?? 0);
  }
}

function fakeContext() {
  const created = {
    gains: [] as FakeGain[],
    oscillators: [] as FakeOscillator[],
  };
  const make = <T>(list: T[], item: T) => {
    list.push(item);
    return item;
  };
  const ctx = {
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    createPeriodicWave: () => ({}),
    currentTime: 2,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = fmSynthDevice.defaults();

/** The voice of the first note: its amp, then each operator's oscillator, envelope and output, in order. */
function voiceOf(created: ReturnType<typeof fakeContext>["created"]) {
  // The engine's own: the output and the vibrato's depth, and the vibrato's oscillator.
  const gains = created.gains.slice(2);
  const oscillators = created.oscillators.slice(1);
  const [amp] = gains;
  const operators = [0, 1, 2, 3].map((index) => ({
    envelope: gains[1 + index * 2],
    oscillator: oscillators[index],
    output: gains[2 + index * 2],
  }));
  return { amp, operators };
}

describe("fmSynthDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(fmSynthDevice.kind).toBe("instrument");
    expect(deviceTools(fmSynthDevice).length).toBeGreaterThan(0);
  });

  test("has eight algorithms, and the first when it is out of range", () => {
    expect(FM_ALGORITHMS).toHaveLength(8);
    expect(fmAlgorithm(5).carriers).toEqual([1, 3]);
    expect(fmAlgorithm(99)).toBe(fmAlgorithm(1));
    expect(fmSynthDevice.format("algorithm", 8)).toBe("8: 4 heard");
  });

  test("a preset is the defaults with what it changes on top", () => {
    expect(FM_SYNTH_PRESETS.map((preset) => preset.name)).toEqual([
      "E.Piano",
      "Tubular",
      "Bass",
      "Brass",
      "Marimba",
      "Clav",
      "Organ",
      "Glass Pad",
    ]);
    expect(fmSynthPreset("Bass").feedback).toBe(6);
    expect(fmSynthPreset("Bass").volume).toBe(defaults.volume);
  });
});

describe("createFmSynthEngine", () => {
  test("each operator plays its ratio of the pitch", () => {
    const { created, ctx } = fakeContext();
    const engine = createFmSynthEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 }, { at: 3 });
    const { operators } = voiceOf(created);
    expect(operators[0]?.oscillator?.frequency.sets[0]?.value).toBeCloseTo(
      220 * ratioOf(defaults.ratio1),
      6
    );
    expect(operators[3]?.oscillator?.frequency.sets[0]?.value).toBeCloseTo(
      220 * ratioOf(defaults.ratio4),
      6
    );
    expect(operators[3]?.oscillator?.waves).toBe(1);
  });

  test("the algorithm wires a carrier into the voice and a modulator into the frequency of the one under it", () => {
    const { created, ctx } = fakeContext();
    const engine = createFmSynthEngine(ctx, { ...defaults, algorithm: 5 });
    engine.noteOn({ frequency: 220 });
    const { amp, operators } = voiceOf(created);
    expect(operators[0]?.output?.connections).toContain(amp);
    expect(operators[2]?.output?.connections).toContain(amp);
    expect(operators[1]?.output?.connections).toContain(
      operators[0]?.oscillator?.frequency
    );
    expect(operators[3]?.output?.connections).toContain(
      operators[2]?.oscillator?.frequency
    );
  });

  test("a harder key modulates deeper: the sound is brighter", () => {
    const soft = fakeContext();
    createFmSynthEngine(soft.ctx, defaults).noteOn({
      frequency: 220,
      velocity: 0,
    });
    const hard = fakeContext();
    createFmSynthEngine(hard.ctx, defaults).noteOn({
      frequency: 220,
      velocity: 1,
    });
    const depthOf = (fake: ReturnType<typeof fakeContext>) =>
      voiceOf(fake.created).operators[1]?.output?.gain.value ?? 0;
    expect(depthOf(hard)).toBeGreaterThan(depthOf(soft) * 2);
  });

  test("each operator rises over the attack, then heads for its own sustain", () => {
    const { created, ctx } = fakeContext();
    const engine = createFmSynthEngine(ctx, {
      ...defaults,
      attack: 5,
      sustain2: 4,
    });
    engine.noteOn({ frequency: 220 }, { at: 3 });
    const { envelope } = voiceOf(created).operators[1] ?? {};
    expect(envelope?.gain.targets[0]).toEqual({ time: 3, value: 1 });
    expect(envelope?.gain.targets[1]?.time).toBeCloseTo(
      3 + attackSeconds(5),
      9
    );
    expect(envelope?.gain.targets[1]?.value).toBeCloseTo(0.4, 9);
  });

  test("a note off releases every operator from where it got to", () => {
    const { created, ctx } = fakeContext();
    const engine = createFmSynthEngine(ctx, { ...defaults, attack: 10 });
    engine.noteOn({ frequency: 220 }, { at: 3 });
    engine.noteOff({ at: 3.01 });
    const { operators } = voiceOf(created);
    for (const operator of operators) {
      const set = operator.envelope?.gain.sets.at(-1);
      expect(set?.time).toBe(3.01);
      expect(set?.value).toBeGreaterThan(0);
      expect(set?.value).toBeLessThan(0.1);
      expect(operator.oscillator?.stopped[0]).toBeCloseTo(
        3.01 + releaseSeconds(defaults.release) * 1.4 + 0.05,
        9
      );
    }
  });

  test("a note while one is held cuts it and strikes anew", () => {
    const { created, ctx } = fakeContext();
    const engine = createFmSynthEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 }, { at: 3 });
    engine.noteOn({ frequency: 330 }, { at: 3.5 });
    expect(voiceOf(created).operators[0]?.oscillator?.stopped).toHaveLength(1);
    expect(created.oscillators).toHaveLength(1 + 8);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, ctx } = fakeContext();
    const engine = createFmSynthEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 }, { id: "a" });
    engine.noteOff({ id: "b" });
    expect(voiceOf(created).operators[0]?.oscillator?.stopped).toHaveLength(0);
  });

  test("a new feedback draws operator 4's wave again under a held note", () => {
    const { created, ctx } = fakeContext();
    const engine = createFmSynthEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 });
    engine.update({ ...defaults, feedback: 8 });
    expect(voiceOf(created).operators[3]?.oscillator?.waves).toBe(2);
  });
});
