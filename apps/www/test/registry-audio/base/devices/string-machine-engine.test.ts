import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  attackSeconds,
  cutoffHertz,
  registerGain,
  releaseSeconds,
  STRING_MACHINE_PRESETS,
  stringMachineDevice,
  stringMachinePreset,
  volumeGain,
} from "@/registry-audio/bases/base/devices/string-machine/device";
import { createStringMachineEngine } from "@/registry-audio/bases/base/devices/string-machine/engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { tau: number; time: number; value: number }[] = [];
  readonly ramps: { time: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ time, value });
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
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
}
class FakeFilter extends FakeNode {
  readonly Q = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}
class FakeOscillator extends FakeNode {
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  started: number[] = [];
  stopped: number[] = [];
  type = "";
  start(when?: number) {
    this.started.push(when ?? 0);
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
    createChannelMerger: () => new FakeNode(),
    createDelay: () => new FakeDelay(),
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    currentTime: 2,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = stringMachineDevice.defaults();
/** The engine's own: its output, bus, dry and the ensemble's three depths, then its wet; and the ensemble's three oscillators. */
const SHARED_GAINS = 7;
const SHARED_OSCILLATORS = 3;

/** The voice of the first note: its amp, its four register levels, its filter and its five oscillators. */
function voiceOf(created: ReturnType<typeof fakeContext>["created"]) {
  const [amp, violin, viola, cello, bass] = created.gains.slice(SHARED_GAINS);
  return {
    amp,
    filter: created.filters[0],
    levels: { bass, cello, viola, violin },
    oscillators: created.oscillators.slice(SHARED_OSCILLATORS),
  };
}

describe("stringMachineDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(stringMachineDevice.kind).toBe("instrument");
    expect(deviceTools(stringMachineDevice).length).toBeGreaterThan(0);
  });

  test("a preset is the defaults with what it changes on top", () => {
    expect(STRING_MACHINE_PRESETS.map((preset) => preset.name)).toEqual([
      "Strings",
      "Violins",
      "Cellos",
      "Full",
      "Swell",
      "Pizz",
      "Dark",
      "Choir",
    ]);
    expect(stringMachinePreset("Violins").violin).toBe(10);
    expect(stringMachinePreset("Violins").volume).toBe(defaults.volume);
  });
});

describe("createStringMachineEngine", () => {
  test("starts its output at its volume", () => {
    const { created, ctx } = fakeContext();
    createStringMachineEngine(ctx, { ...defaults, volume: 10 });
    expect(created.gains[0]?.gain.value).toBeCloseTo(volumeGain(10) * 3, 9);
  });

  test("a note sounds the violin and viola at its pitch, the cello an octave down and the bass two", () => {
    const { created, ctx } = fakeContext();
    createStringMachineEngine(ctx, defaults).noteOn({ frequency: 440 });
    const { levels, oscillators } = voiceOf(created);
    expect(oscillators.map((item) => item.frequency.sets[0]?.value)).toEqual([
      440, 440, 440, 220, 110,
    ]);
    expect(oscillators.map((item) => item.detune.value)).toEqual([
      -7, 7, 0, 0, 0,
    ]);
    expect(levels.violin?.gain.value).toBeCloseTo(
      registerGain(defaults.violin) * 0.11,
      9
    );
    expect(levels.bass?.gain.value).toBe(0);
  });

  test("a note bows in over the attack, a soft one a little quieter", () => {
    const { created, ctx } = fakeContext();
    createStringMachineEngine(ctx, { ...defaults, attack: 5 }).noteOn(
      { frequency: 440, velocity: 0 },
      { at: 3 }
    );
    expect(voiceOf(created).amp?.gain.ramps[0]).toEqual({
      time: 3 + attackSeconds(5),
      value: 0.75,
    });
  });

  test("a note let go during its attack fades from where it got to", () => {
    const { created, ctx } = fakeContext();
    const engine = createStringMachineEngine(ctx, { ...defaults, attack: 10 });
    engine.noteOn({ frequency: 440, velocity: 1 }, { at: 3, id: "a" });
    engine.noteOff({ at: 3 + attackSeconds(10) / 2, id: "a" });
    const { amp, oscillators } = voiceOf(created);
    expect(amp?.gain.sets.at(-1)?.value).toBeCloseTo(0.5, 9);
    expect(amp?.gain.targets.at(-1)?.tau).toBeCloseTo(
      releaseSeconds(defaults.release) / 4,
      9
    );
    expect(oscillators[0]?.stopped).toHaveLength(1);
  });

  test("a note while one is held cuts it and bows anew", () => {
    const { created, ctx } = fakeContext();
    const engine = createStringMachineEngine(ctx, defaults);
    engine.noteOn({ frequency: 440 }, { at: 3 });
    engine.noteOn({ frequency: 330 }, { at: 3.5 });
    expect(voiceOf(created).oscillators[0]?.stopped[0]).toBeCloseTo(
      3.5 + 0.04 * 1.4 + 0.05,
      9
    );
    expect(created.oscillators).toHaveLength(SHARED_OSCILLATORS + 10);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, ctx } = fakeContext();
    const engine = createStringMachineEngine(ctx, defaults);
    engine.noteOn({ frequency: 440 }, { id: "a" });
    engine.noteOff({ id: "b" });
    expect(voiceOf(created).oscillators[0]?.stopped).toHaveLength(0);
  });

  test("a register's level and the brightness move a held note", () => {
    const { created, ctx } = fakeContext();
    const engine = createStringMachineEngine(ctx, defaults);
    engine.noteOn({ frequency: 440 });
    engine.update({ ...defaults, bass: 10, bright: 2 });
    const { filter, levels } = voiceOf(created);
    expect(levels.bass?.gain.targets.at(-1)?.value).toBeCloseTo(0.11, 9);
    expect(filter?.frequency.targets.at(-1)?.value).toBeCloseTo(
      cutoffHertz(2),
      9
    );
  });
});
