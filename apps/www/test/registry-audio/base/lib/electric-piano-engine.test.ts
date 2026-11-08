import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  ELECTRIC_PIANO_PRESETS,
  electricPianoDevice,
  electricPianoPreset,
  ringSeconds,
  volumeGain,
} from "@/registry-audio/bases/base/lib/electric-piano-device";
import { createElectricPianoEngine } from "@/registry-audio/bases/base/lib/electric-piano-engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { constant: number; time: number; value: number }[] = [];
  readonly ramps: { time: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ time, value });
    return this;
  }
  setTargetAtTime(value: number, time: number, constant: number) {
    this.targets.push({ constant, time, value });
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
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
}
class FakeOscillator extends FakeNode {
  readonly frequency = new FakeParam();
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
    createWaveShaper: () => new FakeShaper(),
    currentTime: 2,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = electricPianoDevice.defaults();
/** The engine's own gains (bus, drive, makeup, tremolo, swing, output) and its tremolo's oscillator, made with it. */
const SHARED_GAINS = 6;
const SHARED_OSCILLATORS = 1;

/** The voice of the note struck `index`th: its amp, its carrier, its body and its bell. */
function voiceOf(
  created: ReturnType<typeof fakeContext>["created"],
  index = 0
) {
  const gains = created.gains.slice(SHARED_GAINS);
  const oscillators = created.oscillators.slice(SHARED_OSCILLATORS);
  const [carrier, body, bell] = oscillators.slice(index * 3, index * 3 + 3);
  return { amp: gains[index * 3], bell, body, carrier };
}

describe("electricPianoDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(electricPianoDevice.kind).toBe("instrument");
    expect(deviceTools(electricPianoDevice).length).toBeGreaterThan(0);
  });

  test("a note rings longer in the bass than in the treble", () => {
    expect(ringSeconds(5, 36)).toBeGreaterThan(ringSeconds(5, 84));
    expect(ringSeconds(5, 60)).toBeCloseTo(3.3, 9);
  });

  test("a preset is the defaults with what it changes on top", () => {
    expect(ELECTRIC_PIANO_PRESETS.map((preset) => preset.name)).toEqual([
      "Warm",
      "Bell",
      "Bark",
      "Mellow",
    ]);
    expect(electricPianoPreset("Bark").drive).toBe(6);
    expect(electricPianoPreset("Bark").volume).toBe(defaults.volume);
  });
});

describe("createElectricPianoEngine", () => {
  test("starts its output at the state's volume", () => {
    const { created, ctx } = fakeContext();
    createElectricPianoEngine(ctx, defaults);
    expect(created.gains[SHARED_GAINS - 1]?.gain.value).toBeCloseTo(
      volumeGain(7),
      9
    );
  });

  test("a note strikes the carrier at its pitch, the body on the same, the bell fourteen times up", () => {
    const { created, ctx } = fakeContext();
    const engine = createElectricPianoEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 }, { at: 3 });
    const { bell, body, carrier } = voiceOf(created);
    expect(carrier?.frequency.sets[0]).toEqual({ time: 3, value: 220 });
    expect(body?.frequency.sets[0]?.value).toBe(220);
    expect(bell?.frequency.sets[0]?.value).toBe(220 * 14);
    expect(carrier?.started).toEqual([3]);
  });

  test("a note rises in three milliseconds, then rings down by itself over its ring", () => {
    const { created, ctx } = fakeContext();
    const engine = createElectricPianoEngine(ctx, defaults);
    engine.noteOn({ frequency: 261.6256, velocity: 1 }, { at: 3 });
    const { amp } = voiceOf(created);
    expect(amp?.gain.ramps[0]?.time).toBeCloseTo(3.003, 9);
    expect(amp?.gain.targets[0]?.value).toBe(0);
    expect(amp?.gain.targets[0]?.constant).toBeCloseTo(
      ringSeconds(defaults.decay, 60) / 3,
      6
    );
  });

  test("a harder key is louder", () => {
    const soft = fakeContext();
    createElectricPianoEngine(soft.ctx, defaults).noteOn({
      frequency: 220,
      velocity: 0,
    });
    const hard = fakeContext();
    createElectricPianoEngine(hard.ctx, defaults).noteOn({
      frequency: 220,
      velocity: 1,
    });
    const softPeak = voiceOf(soft.created).amp?.gain.ramps[0]?.value ?? 0;
    const hardPeak = voiceOf(hard.created).amp?.gain.ramps[0]?.value ?? 0;
    expect(softPeak).toBeGreaterThan(0);
    expect(hardPeak).toBeCloseTo(softPeak / 0.3, 9);
  });

  test("a key let go falls silent from where its note got to", () => {
    const { created, ctx } = fakeContext();
    const engine = createElectricPianoEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 }, { at: 3 });
    engine.noteOff({ at: 4 });
    const { amp, carrier } = voiceOf(created);
    const set = amp?.gain.sets.at(-1);
    expect(set?.time).toBe(4);
    expect(set?.value).toBeGreaterThan(0);
    expect(set?.value).toBeLessThan(amp?.gain.ramps[0]?.value ?? 0);
    expect(amp?.gain.targets.at(-1)?.value).toBe(0);
    expect(carrier?.stopped[0]).toBeCloseTo(4 + 0.06 * 8 + 0.05, 9);
  });

  test("a key struck again cuts its note and strikes anew", () => {
    const { created, ctx } = fakeContext();
    const engine = createElectricPianoEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 }, { at: 3 });
    engine.noteOn({ frequency: 330 }, { at: 3.5 });
    expect(voiceOf(created, 0).carrier?.stopped).toHaveLength(1);
    expect(voiceOf(created, 1).carrier?.frequency.sets[0]?.value).toBe(330);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, ctx } = fakeContext();
    const engine = createElectricPianoEngine(ctx, defaults);
    engine.noteOn({ frequency: 220 }, { id: "a" });
    engine.noteOff({ id: "b" });
    expect(voiceOf(created).carrier?.stopped).toHaveLength(0);
  });

  test("a new state moves the drive, the tremolo and the volume", () => {
    const { created, ctx } = fakeContext();
    const engine = createElectricPianoEngine(ctx, defaults);
    engine.update({ ...defaults, depth: 10, volume: 5 });
    const [, , , tremolo, swing, output] = created.gains;
    expect(output?.gain.targets.at(-1)?.value).toBeCloseTo(volumeGain(5), 9);
    expect(tremolo?.gain.targets.at(-1)?.value).toBeCloseTo(0.55, 9);
    expect(swing?.gain.targets.at(-1)?.value).toBeCloseTo(0.45, 9);
  });
});
