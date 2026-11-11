import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/engine/device";
import {
  drawbarGain,
  ORGAN_DRAWBARS,
  ORGAN_PRESETS,
  organDevice,
  organPreset,
  volumeGain,
} from "@/registry-audio/bases/base/devices/organ/device";
import {
  createOrganEngine,
  registrationTrim,
} from "@/registry-audio/bases/base/devices/organ/engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { tau: number; time: number; value: number }[] = [];
  readonly ramps: { time: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ time, value });
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
  connect<T>(destination: T): T {
    return destination;
  }
  disconnected = 0;
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
  readonly frequency = new FakeParam();
  type = "";
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
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
  readonly frequency = new FakeParam();
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
    createBiquadFilter: () => new FakeFilter(),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => new FakeSource(),
    createChannelMerger: () => new FakeNode(),
    createDelay: () => new FakeDelay(),
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    createWaveShaper: () => new FakeNode(),
    currentTime: 2,
    sampleRate: 100,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = organDevice.defaults();
/** The engine's own gains, made with it: its bus, trim, drive, makeup, output, the speaker's two sides, its sways and tremolos. */
const SHARED_GAINS = 11;

/** The key played first: its amp, the levels of its nine drawbars and its nine oscillators, after the speaker's oscillator. */
function keyOf(created: ReturnType<typeof fakeContext>["created"]) {
  const [amp, ...rest] = created.gains.slice(SHARED_GAINS);
  return {
    amp,
    levels: rest.slice(0, 9),
    oscillators: created.oscillators.slice(1, 10),
  };
}

describe("organDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(organDevice.kind).toBe("instrument");
    expect(deviceTools(organDevice).length).toBeGreaterThan(0);
  });

  test("a registration sets the nine drawbars from its digits", () => {
    expect(ORGAN_PRESETS.map((preset) => preset.name)).toEqual([
      "Jazz",
      "Gospel",
      "Rock",
      "Church",
      "Flute",
      "Full",
    ]);
    const church = organPreset("Church");
    expect(ORGAN_DRAWBARS.map((bar) => church[bar.id])).toEqual([
      0, 0, 6, 0, 8, 0, 4, 0, 0,
    ]);
    expect(church.rotary).toBe("stop");
    expect(church.percussion).toBe(false);
  });

  test("a drawbar step is 3 dB, and a drawbar in is silent", () => {
    expect(drawbarGain(8)).toBe(1);
    expect(20 * Math.log10(drawbarGain(7))).toBeCloseTo(-3, 9);
    expect(drawbarGain(0)).toBe(0);
  });

  test("a registration with fewer drawbars out is lifted more", () => {
    expect(registrationTrim(organPreset("Flute"))).toBeGreaterThan(
      registrationTrim(organPreset("Full"))
    );
    expect(
      registrationTrim({ ...defaults, drawbar1: 0, drawbar2: 0, drawbar3: 0 })
    ).toBe(1);
  });
});

describe("createOrganEngine", () => {
  test("starts its output at its volume", () => {
    const { created, ctx } = fakeContext();
    createOrganEngine(ctx, { ...defaults, volume: 10 });
    expect(created.gains[4]?.gain.value).toBeCloseTo(volumeGain(10) * 4, 9);
  });

  test("a key sounds nine sines at the drawbars' harmonics and levels", () => {
    const { created, ctx } = fakeContext();
    createOrganEngine(ctx, defaults).noteOn({ frequency: 200 }, { at: 3 });
    const { levels, oscillators } = keyOf(created);
    expect(oscillators.map((item) => item.frequency.sets[0]?.value)).toEqual(
      ORGAN_DRAWBARS.map((bar) => 200 * bar.ratio)
    );
    expect(levels[0]?.gain.value).toBeCloseTo(drawbarGain(8) * 0.1, 9);
    expect(levels[3]?.gain.value).toBe(0);
  });

  test("the percussion sounds the third harmonic, or the second, only when it is on", () => {
    const off = fakeContext();
    createOrganEngine(off.ctx, defaults).noteOn({ frequency: 200 });
    expect(off.created.oscillators).toHaveLength(1 + 9);
    const on = fakeContext();
    createOrganEngine(on.ctx, { ...defaults, percussion: true }).noteOn({
      frequency: 200,
    });
    expect(on.created.oscillators[10]?.frequency.sets[0]?.value).toBe(600);
    const second = fakeContext();
    createOrganEngine(second.ctx, {
      ...defaults,
      harmonic: "second",
      percussion: true,
    }).noteOn({ frequency: 200 });
    expect(second.created.oscillators[10]?.frequency.sets[0]?.value).toBe(400);
  });

  test("a key let go stops at once, from where its attack got to", () => {
    const { created, ctx } = fakeContext();
    const engine = createOrganEngine(ctx, defaults);
    engine.noteOn({ frequency: 200, velocity: 1 }, { at: 3, id: "a" });
    engine.noteOff({ at: 3.002, id: "a" });
    const { amp, oscillators } = keyOf(created);
    expect(amp?.gain.sets.at(-1)?.value).toBeCloseTo(0.5, 9);
    expect(amp?.gain.targets.at(-1)?.value).toBe(0);
    expect(oscillators[0]?.stopped[0]).toBeCloseTo(3.002 + 0.1, 9);
  });

  test("a note while one is held cuts it and sounds anew", () => {
    const { created, ctx } = fakeContext();
    const engine = createOrganEngine(ctx, defaults);
    engine.noteOn({ frequency: 200 }, { at: 3 });
    engine.noteOn({ frequency: 300 }, { at: 3.5 });
    expect(keyOf(created).oscillators[0]?.stopped).toHaveLength(1);
    expect(created.oscillators).toHaveLength(1 + 18);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, ctx } = fakeContext();
    const engine = createOrganEngine(ctx, defaults);
    engine.noteOn({ frequency: 200 }, { id: "a" });
    engine.noteOff({ id: "b" });
    expect(keyOf(created).oscillators[0]?.stopped).toHaveLength(0);
  });

  test("a drawbar moved sounds on a held key", () => {
    const { created, ctx } = fakeContext();
    const engine = createOrganEngine(ctx, defaults);
    engine.noteOn({ frequency: 200 });
    engine.update({ ...defaults, drawbar4: 8 });
    expect(keyOf(created).levels[3]?.gain.targets.at(-1)?.value).toBeCloseTo(
      0.1,
      9
    );
  });

  test("the rotary speaker takes its time to reach a new speed", () => {
    const { created, ctx } = fakeContext();
    const engine = createOrganEngine(ctx, defaults);
    engine.update({ ...defaults, rotary: "fast" });
    expect(created.oscillators[0]?.frequency.targets.at(-1)).toEqual({
      tau: 0.7,
      time: 2,
      value: 6.6,
    });
  });
});
