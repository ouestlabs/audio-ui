import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  decaySeconds,
  guitarDevice,
  muteShare,
  volumeGain,
} from "@/registry-audio/bases/base/devices/guitar/device";
import {
  createGuitarEngine,
  stringSamples,
} from "@/registry-audio/bases/base/devices/guitar/engine";

class FakeParam {
  value = 0;
  readonly targets: { tau: number; time: number; value: number }[] = [];
  cancelScheduledValues() {
    return this;
  }
  setTargetAtTime(value: number, time: number, tau: number) {
    this.targets.push({ tau, time, value });
    return this;
  }
}
class FakeNode {
  connect<T>(destination: T): T {
    return destination;
  }
  disconnect() {
    return this;
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
class FakeSource extends FakeNode {
  buffer: { length: number } | null = null;
  onended: (() => void) | null = null;
  readonly started: number[] = [];
  readonly stopped: number[] = [];
  start(when?: number) {
    this.started.push(when ?? 0);
  }
  stop(when?: number) {
    this.stopped.push(when ?? 0);
  }
}

const RATE = 8000;

function fakeContext() {
  const created = {
    gains: [] as FakeGain[],
    sources: [] as FakeSource[],
  };
  const ctx = {
    createBiquadFilter: () => new FakeFilter(),
    createBuffer: (_channels: number, length: number) => ({
      copyToChannel: () => undefined,
      length,
    }),
    createBufferSource: () => {
      const source = new FakeSource();
      created.sources.push(source);
      return source;
    },
    createGain: () => {
      const gain = new FakeGain();
      created.gains.push(gain);
      return gain;
    },
    currentTime: 2,
    sampleRate: RATE,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = guitarDevice.defaults();
const hertz = (note: number) => 440 * 2 ** ((note - 69) / 12);

/** The pitch of a ringing string, by where its waveform best repeats, refined between samples. */
function pitchOf(samples: Float32Array, rate: number, near: number) {
  const window = samples.subarray(rate / 20, rate / 20 + 4096);
  const low = Math.floor((rate / near) * 0.9);
  const high = Math.ceil((rate / near) * 1.1);
  const score = (lag: number) => {
    let sum = 0;
    for (let index = 0; index < window.length - high - 2; index += 1) {
      sum += (window[index] ?? 0) * (window[index + lag] ?? 0);
    }
    return sum;
  };
  let best = low;
  for (let lag = low; lag <= high; lag += 1) {
    if (score(lag) > score(best)) {
      best = lag;
    }
  }
  const [before, at, after] = [score(best - 1), score(best), score(best + 1)];
  return rate / (best + (before - after) / (2 * (before - 2 * at + after)));
}

describe("guitarDevice", () => {
  test("is an instrument an agent plays by pitch and velocity", () => {
    expect(guitarDevice.kind).toBe("instrument");
    expect(guitarDevice.note.map((part) => part.id)).toEqual([
      "frequency",
      "velocity",
    ]);
    expect(deviceTools(guitarDevice).length).toBeGreaterThan(0);
  });

  test("the palm mute leaves a string a tenth of its ring at the top", () => {
    expect(muteShare(0)).toBe(1);
    expect(muteShare(10)).toBeCloseTo(0.1, 9);
    expect(decaySeconds(10)).toBeCloseTo(6, 9);
  });
});

describe("stringSamples", () => {
  test("a string is in tune to the cent across the neck", () => {
    for (const note of [40, 52, 64, 71]) {
      const samples = stringSamples({
        frequency: hertz(note),
        ring: 2,
        sampleRate: 48_000,
        seconds: 0.3,
        velocity: 1,
      });
      const cents =
        1200 * Math.log2(pitchOf(samples, 48_000, hertz(note)) / hertz(note));
      expect(Math.abs(cents)).toBeLessThan(1);
    }
  });

  test("a string fades: its end is far quieter than its start", () => {
    const samples = stringSamples({
      frequency: hertz(52),
      ring: 0.5,
      sampleRate: RATE,
      seconds: 0.6,
      velocity: 1,
    });
    const peak = (from: number, to: number) =>
      Math.max(...Array.from(samples.subarray(from, to), Math.abs));
    expect(peak(RATE * 0.5, RATE * 0.6)).toBeLessThan(
      peak(0, RATE * 0.1) / 100
    );
  });
});

describe("createGuitarEngine", () => {
  test("starts its output at its volume", () => {
    const { created, ctx } = fakeContext();
    createGuitarEngine(ctx, { ...defaults, volume: 10 });
    expect(created.gains[1]?.gain.value).toBeCloseTo(volumeGain(10) * 2, 9);
  });

  test("a note picks a string at its time, as long as the decay, shortened by the mute", () => {
    const { created, ctx } = fakeContext();
    createGuitarEngine(ctx, { ...defaults, decay: 5, mute: 10 }).noteOn(
      { frequency: 196 },
      { at: 3 }
    );
    const [source] = created.sources;
    expect(source?.started).toEqual([3]);
    const ring = decaySeconds(5) * muteShare(10);
    expect(source?.buffer?.length).toBe(Math.round((ring + 0.1) * RATE));
  });

  test("a softer pick is quieter", () => {
    const hard = fakeContext();
    createGuitarEngine(hard.ctx, defaults).noteOn({ frequency: 196 });
    const soft = fakeContext();
    createGuitarEngine(soft.ctx, defaults).noteOn({
      frequency: 196,
      velocity: 0.2,
    });
    const level = (made: ReturnType<typeof fakeContext>) =>
      made.created.gains.at(-1)?.gain.value ?? 0;
    expect(level(soft)).toBeLessThan(level(hard) / 2);
  });

  test("let go, the string falls silent at once", () => {
    const { created, ctx } = fakeContext();
    const engine = createGuitarEngine(ctx, defaults);
    engine.noteOn({ frequency: 196 }, { at: 3, id: "g" });
    engine.noteOff({ at: 4, id: "g" });
    expect(created.gains.at(-1)?.gain.targets.at(-1)).toEqual({
      tau: 0.03,
      time: 4,
      value: 0,
    });
    expect(created.sources[0]?.stopped[0]).toBeCloseTo(4.24, 9);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, ctx } = fakeContext();
    const engine = createGuitarEngine(ctx, defaults);
    engine.noteOn({ frequency: 196 }, { id: "a" });
    engine.noteOff({ id: "b" });
    expect(created.sources[0]?.stopped).toHaveLength(0);
  });

  test("a new note cuts the one ringing", () => {
    const { created, ctx } = fakeContext();
    const engine = createGuitarEngine(ctx, defaults);
    engine.noteOn({ frequency: 196 }, { at: 3 });
    engine.noteOn({ frequency: 220 }, { at: 3.5 });
    expect(created.sources[0]?.stopped[0]).toBeCloseTo(3.74, 9);
    expect(created.sources[1]?.started).toEqual([3.5]);
  });
});
