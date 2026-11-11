import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/engine/device";
import {
  cutoffHertz,
  releaseSeconds,
  SAMPLER_FIRST_NOTE,
  samplerDevice,
  sliceOf,
  volumeGain,
} from "@/registry-audio/bases/base/devices/sampler/device";
import { createSamplerEngine } from "@/registry-audio/bases/base/devices/sampler/engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { time: number; value: number }[] = [];
  readonly ramps: { time: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ time, value });
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
class FakeFilter extends FakeNode {
  readonly Q = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  readonly playbackRate = new FakeParam();
  started: { length: number; offset: number; time: number }[] = [];
  stopped: number[] = [];
  start(time: number, offset: number, length: number) {
    this.started.push({ length, offset, time });
  }
  stop(when?: number) {
    this.stopped.push(when ?? 0);
  }
}

function fakeContext() {
  const created = {
    gains: [] as FakeGain[],
    sources: [] as FakeSource[],
  };
  const make = <T>(list: T[], item: T) => {
    list.push(item);
    return item;
  };
  const ctx = {
    createBiquadFilter: () => new FakeFilter(),
    createBufferSource: () => make(created.sources, new FakeSource()),
    createGain: () => make(created.gains, new FakeGain()),
    currentTime: 2,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = samplerDevice.defaults();
/** A sample of 3.2 seconds: sixteen slices of 0.2 s. */
const SAMPLE = { duration: 3.2 } as AudioBuffer;
const noteOf = (pitch: number, velocity = 1) => ({
  frequency: 440 * 2 ** ((pitch - 69) / 12),
  velocity,
});

/** An engine with the 3.2 s sample loaded, as a host loads a file. */
function loaded(state = defaults) {
  const fake = fakeContext();
  const engine = createSamplerEngine(fake.ctx, state);
  engine.load(SAMPLE);
  return { ...fake, engine };
}

describe("samplerDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(samplerDevice.kind).toBe("instrument");
    expect(deviceTools(samplerDevice).length).toBeGreaterThan(0);
  });

  test("a pitch picks its slice from the first note, round again after sixteen", () => {
    expect(sliceOf(SAMPLER_FIRST_NOTE)).toBe(0);
    expect(sliceOf(SAMPLER_FIRST_NOTE + 5)).toBe(5);
    expect(sliceOf(SAMPLER_FIRST_NOTE + 16)).toBe(0);
    expect(sliceOf(SAMPLER_FIRST_NOTE - 1)).toBe(15);
  });
});

describe("createSamplerEngine", () => {
  test("starts its filter and its output from the state", () => {
    const { created, ctx } = fakeContext();
    createSamplerEngine(ctx, { ...defaults, volume: 10 });
    expect(created.gains[0]?.gain.value).toBeCloseTo(volumeGain(10) * 0.7, 9);
    expect(cutoffHertz(10)).toBeCloseTo(18_000, 6);
  });

  test("a note before a sample is there plays nothing", () => {
    const { created, ctx } = fakeContext();
    const engine = createSamplerEngine(ctx, defaults);
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE));
    expect(created.sources).toHaveLength(0);
  });

  test("a note plays its slice, from its start for its length", () => {
    const { created, engine } = loaded();
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE + 3), { at: 3 });
    const [source] = created.sources;
    expect(source?.buffer).toBe(SAMPLE);
    expect(source?.started[0]?.time).toBe(3);
    expect(source?.started[0]?.offset).toBeCloseTo(0.6, 9);
    expect(source?.started[0]?.length).toBeCloseTo(0.2, 9);
  });

  test("the pitch transposes the slice by its playback rate", () => {
    const { created, engine } = loaded({ ...defaults, pitch: 12 });
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE));
    expect(created.sources[0]?.playbackRate.sets[0]?.value).toBe(2);
  });

  test("a slice rises to its velocity, and its tail fades out by its end", () => {
    const { created, engine } = loaded();
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE, 0.5), { at: 3 });
    const [, tail, env] = created.gains;
    expect(env?.gain.ramps[0]?.value).toBe(0.5);
    expect(tail?.gain.ramps.at(-1)).toEqual({ time: 3.2, value: 0 });
  });

  test("struck, a slice plays to its end: a note off lets it be", () => {
    const { created, engine } = loaded();
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE), { at: 3 });
    engine.noteOff({ at: 3.05 });
    expect(created.sources[0]?.stopped).toHaveLength(0);
  });

  test("with the gate on, a note off closes the slice over the release", () => {
    const { created, engine } = loaded({ ...defaults, gate: true });
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE), { at: 3 });
    engine.noteOff({ at: 3.05 });
    expect(created.sources[0]?.stopped[0]).toBeCloseTo(
      3.05 + releaseSeconds(defaults.release) + 0.05,
      9
    );
  });

  test("a note while one plays cuts it and plays anew", () => {
    const { created, engine } = loaded();
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE), { at: 3 });
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE + 1), { at: 3.1 });
    expect(created.sources[0]?.stopped).toHaveLength(1);
    expect(created.sources[1]?.started[0]?.offset).toBeCloseTo(0.2, 9);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, engine } = loaded({ ...defaults, gate: true });
    engine.noteOn(noteOf(SAMPLER_FIRST_NOTE), { id: "a" });
    engine.noteOff({ id: "b" });
    expect(created.sources[0]?.stopped).toHaveLength(0);
  });
});
