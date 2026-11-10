import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  attackSeconds,
  glideSeconds,
  MONO_SYNTH_PRESETS,
  monoSynthDevice,
  monoSynthPreset,
  releaseSeconds,
  volumeGain,
} from "@/registry-audio/bases/base/devices/mono-synth/device";
import { createMonoSynthEngine } from "@/registry-audio/bases/base/devices/mono-synth/engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { time: number; tau: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  setTargetAtTime(value: number, time: number, tau: number) {
    this.targets.push({ tau, time, value });
    return this;
  }
  setValueAtTime(value: number, time: number) {
    this.sets.push({ time, value });
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
class FakeFilter extends FakeNode {
  readonly Q = new FakeParam();
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  started: number[] = [];
  stopped: number[] = [];
  start(when?: number) {
    this.started.push(when ?? 0);
  }
  stop(when?: number) {
    this.stopped.push(when ?? 0);
  }
}
class FakeOscillator extends FakeSource {
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
  waves = 0;
  setPeriodicWave() {
    this.waves += 1;
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
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => new FakeSource(),
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    createPeriodicWave: () => ({}),
    currentTime: 2,
    sampleRate: 100,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = monoSynthDevice.defaults();

/** The synth's nodes, in the order it makes them: its output and envelope, its filter, its oscillator and sub. */
function synth(state = defaults) {
  const { created, ctx } = fakeContext();
  const engine = createMonoSynthEngine(ctx, state);
  const [output, gate] = created.gains;
  const [filter] = created.filters;
  const [oscillator, sub] = created.oscillators;
  if (!(output && gate && filter && oscillator && sub)) {
    throw new Error("the engine made fewer nodes than it should");
  }
  return { engine, filter, gate, oscillator, output, sub };
}

describe("monoSynthDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(monoSynthDevice.kind).toBe("instrument");
    expect(deviceTools(monoSynthDevice).length).toBeGreaterThan(0);
  });

  test("a preset is the defaults with what it changes on top", () => {
    expect(MONO_SYNTH_PRESETS.map((preset) => preset.name)).toEqual([
      "Init Saw",
      "Warm Pad",
      "Acid Bass",
      "Pluck",
      "Brass",
      "Sub Bass",
      "Lead",
      "Wind",
    ]);
    expect(monoSynthPreset("Lead").wave).toBe("square");
    expect(monoSynthPreset("Lead").width).toBe(5);
    expect(monoSynthPreset("Acid Bass").volume).toBe(defaults.volume);
  });
});

describe("createMonoSynthEngine", () => {
  test("is silent until a note, at the output its volume sets", () => {
    const { gate, output } = synth({ ...defaults, volume: 10 });
    expect(gate.gain.value).toBe(0);
    expect(output.gain.value).toBeCloseTo(volumeGain(10) * 2, 9);
  });

  test("the first note opens the envelope to its velocity, then heads for the sustain", () => {
    const { engine, gate } = synth({ ...defaults, attack: 5, sustain: 4 });
    engine.noteOn({ frequency: 220, velocity: 1 }, { at: 3, id: "a" });
    expect(gate.gain.targets[0]?.time).toBe(3);
    expect(gate.gain.targets[0]?.value).toBe(1);
    expect(gate.gain.targets[1]?.time).toBeCloseTo(3 + attackSeconds(5), 9);
    expect(gate.gain.targets[1]?.value).toBeCloseTo(0.4, 9);
  });

  test("a soft note opens to less than a hard one", () => {
    const { engine, gate } = synth();
    engine.noteOn({ frequency: 220, velocity: 0 }, { at: 3 });
    expect(gate.gain.targets[0]?.value).toBe(0.25);
  });

  test("the range moves the pitch by octaves, the sub an octave under it", () => {
    const { engine, oscillator, sub } = synth({ ...defaults, range: "16'" });
    engine.noteOn({ frequency: 220 }, { at: 3 });
    expect(oscillator.frequency.sets.at(-1)).toEqual({ time: 3, value: 110 });
    expect(sub.frequency.sets.at(-1)).toEqual({ time: 3, value: 55 });
  });

  test("a note while one is held glides to it and leaves the envelope as it is", () => {
    const { engine, gate, oscillator } = synth({ ...defaults, glide: 5 });
    engine.noteOn({ frequency: 220 }, { at: 3, id: "a" });
    const opened = gate.gain.targets.length;
    engine.noteOn({ frequency: 330 }, { at: 3.5, id: "b" });
    expect(gate.gain.targets).toHaveLength(opened);
    expect(oscillator.frequency.targets.at(-1)).toEqual({
      tau: glideSeconds(5) / 3,
      time: 3.5,
      value: 330,
    });
  });

  test("letting go of the note heard glides back to the one still held", () => {
    const { engine, gate, oscillator } = synth();
    engine.noteOn({ frequency: 220 }, { at: 3, id: "a" });
    engine.noteOn({ frequency: 330 }, { at: 3.5, id: "b" });
    const opened = gate.gain.targets.length;
    engine.noteOff({ at: 4, id: "b" });
    expect(oscillator.frequency.targets.at(-1)?.value).toBe(220);
    expect(gate.gain.targets).toHaveLength(opened);
  });

  test("letting go of a note under the one heard changes nothing heard", () => {
    const { engine, gate, oscillator } = synth();
    engine.noteOn({ frequency: 220 }, { at: 3, id: "a" });
    engine.noteOn({ frequency: 330 }, { at: 3.5, id: "b" });
    const glides = oscillator.frequency.targets.length;
    const opened = gate.gain.targets.length;
    engine.noteOff({ at: 4, id: "a" });
    expect(oscillator.frequency.targets).toHaveLength(glides);
    expect(gate.gain.targets).toHaveLength(opened);
  });

  test("letting go of the last note releases from where the envelope got to", () => {
    const { engine, filter, gate } = synth({ ...defaults, attack: 10 });
    engine.noteOn({ frequency: 220 }, { at: 3, id: "a" });
    engine.noteOff({ at: 3.01, id: "a" });
    const set = gate.gain.sets.at(-1);
    expect(set?.time).toBe(3.01);
    expect(set?.value).toBeGreaterThan(0);
    expect(set?.value).toBeLessThan(0.1);
    expect(gate.gain.targets.at(-1)).toEqual({
      tau: releaseSeconds(defaults.release) / 4,
      time: 3.01,
      value: 0,
    });
    expect(filter.detune.targets.at(-1)?.value).toBe(0);
  });

  test("a note during a release opens again from where the release got to", () => {
    const { engine, gate } = synth({ ...defaults, attack: 0, release: 10 });
    engine.noteOn({ frequency: 220 }, { at: 3, id: "a" });
    engine.noteOff({ at: 4, id: "a" });
    engine.noteOn({ frequency: 220 }, { at: 4.1, id: "b" });
    expect(gate.gain.sets.at(-1)?.time).toBe(4.1);
    expect(gate.gain.sets.at(-1)?.value).toBeGreaterThan(0.3);
  });

  test("a note off that names no note held lets nothing go; one with no id lets every note go", () => {
    const { engine, gate } = synth();
    engine.noteOn({ frequency: 220 }, { at: 3, id: "a" });
    engine.noteOn({ frequency: 330 }, { at: 3.1, id: "b" });
    const opened = gate.gain.targets.length;
    engine.noteOff({ at: 3.2, id: "c" });
    expect(gate.gain.targets).toHaveLength(opened);
    engine.noteOff({ at: 3.3 });
    expect(gate.gain.targets.at(-1)?.value).toBe(0);
  });

  test("the square is drawn at its width, and a new width draws it again", () => {
    const { engine, oscillator } = synth({ ...defaults, wave: "square" });
    expect(oscillator.waves).toBe(1);
    engine.update({ ...defaults, wave: "square", width: 6 });
    expect(oscillator.waves).toBe(2);
    engine.update({ ...defaults, wave: "triangle", width: 6 });
    expect(oscillator.type).toBe("triangle");
  });

  test("a held note follows the range the moment it changes", () => {
    const { engine, oscillator } = synth();
    engine.noteOn({ frequency: 220 }, { at: 3, id: "a" });
    engine.update({ ...defaults, range: "4'" });
    expect(oscillator.frequency.sets.at(-1)?.value).toBe(440);
  });
});
