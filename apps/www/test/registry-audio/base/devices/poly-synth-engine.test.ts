import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/engine/device";
import {
  attackSeconds,
  contourCents,
  cutoffHertz,
  POLY_SYNTH_PRESETS,
  polySynthDevice,
  polySynthPreset,
  releaseSeconds,
  volumeGain,
} from "@/registry-audio/bases/base/devices/poly-synth/device";
import { createPolySynthEngine } from "@/registry-audio/bases/base/devices/poly-synth/engine";

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
  onended: (() => void) | null = null;
  waves = 0;
  type = "";
  setPeriodicWave() {
    this.waves += 1;
  }
}

function fakeContext() {
  const created = {
    filters: [] as FakeFilter[],
    gains: [] as FakeGain[],
    oscillators: [] as FakeOscillator[],
    sources: [] as FakeSource[],
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
    createBufferSource: () => make(created.sources, new FakeSource()),
    createChannelMerger: () => new FakeNode(),
    createDelay: () => new FakeDelay(),
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    createPeriodicWave: () => ({}),
    currentTime: 2,
    sampleRate: 100,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = polySynthDevice.defaults();
const NOTE = { frequency: 261.63, velocity: 1 };
/** The engine's own oscillators, made with it: the chorus's and the vibrato's. */
const SHARED_OSCILLATORS = 2;

/** The voice of the note played first: its three oscillators, its noise, its filter and its amp. */
function voiceOf(created: ReturnType<typeof fakeContext>["created"]) {
  const [saw, pulse, sub] = created.oscillators.slice(SHARED_OSCILLATORS);
  const amp = created.gains.at(-1);
  return {
    amp,
    filter: created.filters[0],
    noise: created.sources[0],
    pulse,
    saw,
    sub,
  };
}

describe("polySynthDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(polySynthDevice.kind).toBe("instrument");
    expect(polySynthDevice.note.map((parameter) => parameter.id)).toEqual([
      "frequency",
      "velocity",
    ]);
    expect(deviceTools(polySynthDevice).length).toBeGreaterThan(0);
  });

  test("a preset is the defaults with what it changes on top", () => {
    expect(POLY_SYNTH_PRESETS).toHaveLength(8);
    const bass = polySynthPreset("Fat Bass");
    expect(bass.sub).toBe(8);
    expect(bass.chorus).toBe("Off");
    expect(bass.volume).toBe(defaults.volume);
  });

  test("each control reads its value in the unit the sound takes", () => {
    expect(polySynthDevice.format("cutoff", 0)).toBe("40 Hz");
    expect(polySynthDevice.format("attack", 0)).toBe("3 ms");
    expect(polySynthDevice.format("volume", 0)).toBe("-∞ dB");
  });
});

describe("createPolySynthEngine", () => {
  test("starts its output at the state's volume", () => {
    const { created, ctx } = fakeContext();
    createPolySynthEngine(ctx, defaults);
    expect(created.gains[0]?.gain.value).toBeCloseTo(volumeGain(7) * 4, 9);
  });

  test("a note plays the saw and the pulse at its pitch, the sub an octave down, and the noise", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, defaults);
    engine.noteOn(NOTE, { at: 3 });
    const { noise, pulse, saw, sub } = voiceOf(created);
    expect(saw?.type).toBe("sawtooth");
    expect(saw?.frequency.sets[0]).toEqual({ time: 3, value: 261.63 });
    expect(pulse?.waves).toBe(1);
    expect(sub?.frequency.sets[0]?.value).toBeCloseTo(130.815, 9);
    expect(saw?.started).toEqual([3]);
    expect(noise?.loop).toBe(true);
    expect(noise?.started).toEqual([3]);
  });

  test("the filter follows the keyboard: an octave up opens it by the key follow", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, {
      ...defaults,
      cutoff: 5,
      keys: 10,
    });
    engine.noteOn({ frequency: 523.26 });
    expect(created.filters[0]?.frequency.sets[0]?.value).toBeCloseTo(
      cutoffHertz(5) * 2,
      6
    );
  });

  test("the envelope heads for the velocity's level, then the sustain, and opens the filter with it", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, {
      ...defaults,
      attack: 3,
      contour: 5,
      sustain: 5,
    });
    engine.noteOn({ frequency: 220, velocity: 1 }, { at: 3 });
    const { amp, filter } = voiceOf(created);
    expect(amp?.gain.targets[0]).toEqual({ time: 3, value: 1 });
    expect(amp?.gain.targets[1]?.time).toBeCloseTo(3 + attackSeconds(3), 9);
    expect(amp?.gain.targets[1]?.value).toBeCloseTo(0.5, 9);
    expect(filter?.detune.targets[0]?.value).toBeCloseTo(contourCents(5), 9);
    expect(filter?.detune.targets[1]?.value).toBeCloseTo(
      contourCents(5) / 2,
      9
    );
  });

  test("a soft note still sounds", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, defaults);
    engine.noteOn({ frequency: 220, velocity: 0 });
    expect(voiceOf(created).amp?.gain.targets[0]?.value).toBeCloseTo(0.25, 9);
  });

  test("a note off releases from where the envelope got to, and the voice ends after its release", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, { ...defaults, attack: 10 });
    engine.noteOn(NOTE, { at: 3 });
    engine.noteOff({ at: 3.01 });
    const { amp, noise, saw } = voiceOf(created);
    const set = amp?.gain.sets.at(-1);
    expect(set?.time).toBe(3.01);
    expect(set?.value).toBeGreaterThan(0);
    expect(set?.value).toBeLessThan(0.1);
    expect(amp?.gain.targets.at(-1)?.value).toBe(0);
    const end = 3.01 + releaseSeconds(defaults.release) * 1.4 + 0.05;
    expect(saw?.stopped[0]).toBeCloseTo(end, 9);
    expect(noise?.stopped[0]).toBeCloseTo(end, 9);
  });

  test("a note while one is held glides the voice to it", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.noteOn({ frequency: 440 });
    expect(created.oscillators).toHaveLength(SHARED_OSCILLATORS + 3);
    expect(voiceOf(created).saw?.frequency.targets[0]?.value).toBe(440);
    expect(voiceOf(created).sub?.frequency.targets[0]?.value).toBe(220);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, defaults);
    engine.noteOn(NOTE, { id: "a" });
    engine.noteOff({ id: "b" });
    expect(voiceOf(created).saw?.stopped).toHaveLength(0);
  });

  test("a new state moves the volume and the chorus, and draws the pulse again only when its width changes", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    engine.update({ ...defaults, chorus: "Off", volume: 5 });
    expect(created.gains[0]?.gain.targets.at(-1)?.value).toBeCloseTo(
      volumeGain(5) * 4,
      9
    );
    expect(voiceOf(created).pulse?.waves).toBe(1);
    engine.update({ ...defaults, width: 8 });
    expect(voiceOf(created).pulse?.waves).toBe(2);
  });

  test("a voice lets go of its nodes when it ends", () => {
    const { created, ctx } = fakeContext();
    const engine = createPolySynthEngine(ctx, defaults);
    engine.noteOn(NOTE);
    voiceOf(created).saw?.onended?.();
    expect(created.filters[0]?.disconnected).toBe(1);
    expect(voiceOf(created).sub?.disconnected).toBe(1);
  });
});
