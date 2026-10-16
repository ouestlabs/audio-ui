import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  waveShaperCurve,
  waveShaperCutoff,
  waveShaperDevice,
  waveShaperPitch,
  waveShaperResonance,
} from "@/registry-audio/bases/base/lib/wave-shaper-device";
import { createWaveShaperEngine } from "@/registry-audio/bases/base/lib/wave-shaper-engine";

class FakeParam {
  value = 0;
  readonly sets: number[] = [];
  readonly targets: number[] = [];
  cancelScheduledValues() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
  setValueAtTime(value: number) {
    this.sets.push(value);
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
  readonly frequency = new FakeParam();
  type = "";
}
class FakeOscillator extends FakeNode {
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  onended: (() => void) | null = null;
  started = 0;
  readonly stopped: number[] = [];
  type = "";
  start() {
    this.started += 1;
  }
  stop(when?: number) {
    this.stopped.push(when ?? 0);
  }
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "";
  curveSets = 0;
}

function fakeContext() {
  const made = {
    filters: [] as FakeFilter[],
    gains: [] as FakeGain[],
    oscillators: [] as FakeOscillator[],
    shapers: [] as FakeShaper[],
  };
  const track = <T>(list: T[], item: T) => {
    list.push(item);
    return item;
  };
  const ctx = {
    createBiquadFilter: () => track(made.filters, new FakeFilter()),
    createGain: () => track(made.gains, new FakeGain()),
    createDelay: () => ({
      connect: <T>(to: T) => to,
      delayTime: { value: 0 },
      disconnect: () => undefined,
    }),
    createOscillator: () => track(made.oscillators, new FakeOscillator()),
    createWaveShaper: () => track(made.shapers, new FakeShaper()),
    currentTime: 2,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const defaults = waveShaperDevice.defaults();
const NOTE = { frequency: 220, resonance: 4 };

describe("the wave shaper device", () => {
  test("is an instrument with a waveform, drive, tone, detune, mix and volume", () => {
    expect(waveShaperDevice.kind).toBe("instrument");
    expect(
      waveShaperDevice.parameters.map((parameter) => parameter.id)
    ).toEqual(["wave", "drive", "tone", "detune", "mix", "volume"]);
  });

  test("a pad position plays a pitch on a log axis and a resonance on a line", () => {
    expect(waveShaperPitch(0)).toBeCloseTo(55, 6);
    expect(waveShaperPitch(1)).toBeCloseTo(880, 6);
    expect(waveShaperResonance(0)).toBeCloseTo(0.5, 6);
    expect(waveShaperResonance(1)).toBeCloseTo(15.5, 6);
    expect(waveShaperCutoff(0)).toBe(500);
    expect(waveShaperCutoff(100)).toBe(8000);
  });

  test("the distortion curve is odd, passes zero and grows more bent with drive", () => {
    const soft = waveShaperCurve(0);
    const hard = waveShaperCurve(100);
    const middle = Math.floor(soft.length / 2);
    expect(Math.abs(soft[middle] ?? 1)).toBeLessThan(1e-3);
    expect(soft.at(-1)).toBeGreaterThan(0);
    expect(soft[0]).toBeLessThan(0);
    // The more it drives, the flatter the top: a loud input comes out closer to its limit.
    const top = soft.length - 1;
    expect((hard[top] ?? 0) / (hard[(top * 0.75) | 0] ?? 1)).toBeLessThan(
      (soft[top] ?? 0) / (soft[(top * 0.75) | 0] ?? 1)
    );
  });
});

describe("createWaveShaperEngine", () => {
  test("starts the output at the state's volume", () => {
    const { ctx, made } = fakeContext();
    createWaveShaperEngine(ctx, { ...defaults, volume: 1 });
    expect(made.gains[0]?.gain.value).toBeCloseTo(0.4, 6);
  });

  test("a note starts two oscillators, the second detuned, through a shaper and a low-pass", () => {
    const { ctx, made } = fakeContext();
    const engine = createWaveShaperEngine(ctx, {
      ...defaults,
      detune: 12,
      wave: "sawtooth",
    });
    engine.noteOn(NOTE);
    expect(made.oscillators).toHaveLength(2);
    expect(made.oscillators.map((oscillator) => oscillator.type)).toEqual([
      "sawtooth",
      "sawtooth",
    ]);
    expect(made.oscillators[1]?.detune.sets[0]).toBe(12);
    expect(made.shapers[0]?.oversample).toBe("4x");
    expect(made.filters[0]?.type).toBe("lowpass");
    expect(made.filters[0]?.Q.sets[0]).toBe(4);
  });

  test("a note while one is held glides it, with no new voice", () => {
    const { ctx, made } = fakeContext();
    const engine = createWaveShaperEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.noteOn({ frequency: 440, resonance: 9 });
    expect(made.oscillators).toHaveLength(2);
    expect(made.oscillators[0]?.frequency.targets).toEqual([440]);
    expect(made.filters[0]?.Q.targets).toEqual([9]);
  });

  test("a note off stops both oscillators, and the next note is a new voice", () => {
    const { ctx, made } = fakeContext();
    const engine = createWaveShaperEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.noteOff();
    expect(made.oscillators.every((o) => o.stopped.length === 1)).toBe(true);
    engine.noteOn(NOTE);
    expect(made.oscillators).toHaveLength(4);
  });

  test("a new state moves the held voice: wave, detune, tone and mix", () => {
    const { ctx, made } = fakeContext();
    const engine = createWaveShaperEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.update({
      ...defaults,
      detune: -20,
      mix: 100,
      tone: 100,
      wave: "square",
    });
    expect(made.oscillators.map((o) => o.type)).toEqual(["square", "square"]);
    expect(made.oscillators[1]?.detune.targets).toEqual([-20]);
    expect(made.filters[0]?.frequency.targets).toEqual([8000]);
    // The mix: dry to 0 and wet to 1.
    const gains = made.gains.flatMap((gain) => gain.gain.targets);
    expect(gains).toContain(0);
    expect(gains).toContain(1);
  });

  test("dispose stops the held voice", () => {
    const { ctx, made } = fakeContext();
    const engine = createWaveShaperEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.dispose();
    expect(made.oscillators.every((o) => o.stopped.length === 1)).toBe(true);
    expect(made.gains[0]?.disconnected).toBe(1);
  });
});

describe("an agent playing the wave shaper", () => {
  const [, , play] = deviceTools(waveShaperDevice);

  test("the play tool gives a pitch and a resonance, in bounds", () => {
    expect(play?.name).toBe("audioui_wave_shaper_play");
    const result = play?.run(waveShaperDevice.defaults(), {
      frequency: 110,
      resonance: 40,
    });
    expect(result?.note).toEqual({ frequency: 110, resonance: 15.5 });
    expect(result?.summary).toContain("Resonance: 15.5 (brought into range)");
  });
});
