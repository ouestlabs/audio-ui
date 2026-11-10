import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  DRUM_SYNTH_VOICES,
  decaySeconds,
  drumSynthDevice,
  drumSynthPreset,
  VOICE_DECAYS,
  volumeGain,
} from "@/registry-audio/bases/base/devices/drum-synth/device";
import { createDrumSynthEngine } from "@/registry-audio/bases/base/devices/drum-synth/engine";

class FakeParam {
  value = 0;
  readonly set: { time: number; value: number }[] = [];
  readonly ramps: { time: number; value: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.set.push({ time, value });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ time, value });
    return this;
  }
  setTargetAtTime() {
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
class FakeScheduled extends FakeNode {
  readonly started: number[] = [];
  onended: (() => void) | null = null;
  start(when = 0) {
    this.started.push(when);
  }
  stop() {
    return this;
  }
}
class FakeOscillator extends FakeScheduled {
  readonly frequency = new FakeParam();
  type = "sine";
}
class FakeSource extends FakeScheduled {
  buffer: unknown = null;
}
class FakeFilter extends FakeNode {
  readonly Q = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}

function fakeContext() {
  const made = {
    buffers: 0,
    gains: [] as FakeGain[],
    oscillators: [] as FakeOscillator[],
    sources: [] as FakeSource[],
  };
  const ctx = {
    createBiquadFilter: () => new FakeFilter(),
    createBuffer: (_channels: number, length: number) => {
      made.buffers += 1;
      return { getChannelData: () => new Float32Array(length), length };
    },
    createBufferSource: () => {
      const source = new FakeSource();
      made.sources.push(source);
      return source;
    },
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    createOscillator: () => {
      const oscillator = new FakeOscillator();
      made.oscillators.push(oscillator);
      return oscillator;
    },
    currentTime: 1,
    sampleRate: 8000,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

describe("drumSynthDevice", () => {
  test("is an instrument an agent strikes by velocity, with a voice to pick", () => {
    expect(drumSynthDevice.kind).toBe("instrument");
    expect(drumSynthDevice.note.map((part) => part.id)).toEqual(["velocity"]);
    expect(deviceTools(drumSynthDevice).length).toBeGreaterThan(0);
    expect(drumSynthPreset("snare").voice).toBe("snare");
  });

  test("the volume's default plays at unity, its top 8 dB above", () => {
    expect(volumeGain(drumSynthDevice.defaults().volume)).toBeCloseTo(1, 9);
    expect(20 * Math.log10(volumeGain(10))).toBeCloseTo(8, 9);
    expect(volumeGain(0)).toBe(0);
  });

  test("the decay's middle is the voice's own ring, its ends an eighth and eight times", () => {
    for (const { value } of DRUM_SYNTH_VOICES) {
      expect(decaySeconds(value, 5)).toBeCloseTo(VOICE_DECAYS[value], 9);
      expect(decaySeconds(value, 0)).toBeCloseTo(VOICE_DECAYS[value] / 8, 9);
      expect(decaySeconds(value, 10)).toBeCloseTo(VOICE_DECAYS[value] * 8, 9);
    }
  });
});

describe("createDrumSynthEngine", () => {
  test("starts its output at its volume", () => {
    const { ctx, made } = fakeContext();
    createDrumSynthEngine(ctx, drumSynthPreset("kick", { volume: 10 }));
    expect(made.gains[0]?.gain.value).toBeCloseTo(volumeGain(10), 9);
  });

  test("a kick is a sine falling to its pitch, struck at the note's time and ringing for its decay", () => {
    const { ctx, made } = fakeContext();
    createDrumSynthEngine(ctx, drumSynthPreset("kick")).noteOn(
      { velocity: 1 },
      { at: 3 }
    );
    const [kick] = made.oscillators;
    expect(kick?.started).toEqual([3]);
    expect(kick?.frequency.ramps.at(-1)).toEqual({ time: 3.06, value: 50 });
    const amp = made.gains.at(-1);
    expect(amp?.gain.ramps.at(-1)?.time).toBeCloseTo(3 + 0.35, 9);
  });

  test("every voice sounds, and every hit reads the one noise made for the context", () => {
    const { ctx, made } = fakeContext();
    for (const { value } of DRUM_SYNTH_VOICES) {
      const engine = createDrumSynthEngine(ctx, drumSynthPreset(value));
      const before = made.oscillators.length + made.sources.length;
      engine.noteOn({ velocity: 1 });
      expect(made.oscillators.length + made.sources.length).toBeGreaterThan(
        before
      );
    }
    expect(made.buffers).toBe(1);
  });

  test("a softer hit is quieter", () => {
    const level = (velocity: number) => {
      const { ctx, made } = fakeContext();
      createDrumSynthEngine(ctx, drumSynthPreset("snare")).noteOn({ velocity });
      return made.gains[1]?.gain.set[0]?.value ?? 0;
    };
    expect(level(0.3)).toBeLessThan(level(1) / 2);
  });

  test("a hit at no velocity makes nothing, and a note off lets nothing go", () => {
    const { ctx, made } = fakeContext();
    const engine = createDrumSynthEngine(ctx, drumSynthPreset("hat"));
    engine.noteOn({ velocity: 0 });
    engine.noteOff();
    expect(made.sources).toHaveLength(0);
  });
});
