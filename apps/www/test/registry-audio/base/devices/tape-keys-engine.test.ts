import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/engine/device";
import {
  speedCents,
  TAPE_SECONDS,
  tapeKeysDevice,
  volumeGain,
} from "@/registry-audio/bases/base/devices/tape-keys/device";
import { createTapeKeysEngine } from "@/registry-audio/bases/base/devices/tape-keys/engine";

class FakeParam {
  value = 0;
  readonly sets: { time: number; value: number }[] = [];
  readonly targets: { tau: number; time: number; value: number }[] = [];
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
  readonly frequency = new FakeParam();
  type = "";
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
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
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}
class FakeConstant extends FakeSource {
  readonly offset = new FakeParam();
}

function fakeContext() {
  const created = {
    constants: [] as FakeConstant[],
    gains: [] as FakeGain[],
    oscillators: [] as FakeOscillator[],
    sources: [] as FakeSource[],
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
    createBufferSource: () => make(created.sources, new FakeSource()),
    createConstantSource: () => make(created.constants, new FakeConstant()),
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    createWaveShaper: () => new FakeNode(),
    currentTime: 2,
    sampleRate: 100,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = tapeKeysDevice.defaults();
/** The engine's own: its bus, output and the capstan's two depths; and the capstan's two oscillators. */
const SHARED_GAINS = 4;
const SHARED_OSCILLATORS = 2;
const C4 = 261.63;

/** The key played first: its amp, then the oscillators that play it, after the vibrato's. */
function keyOf(created: ReturnType<typeof fakeContext>["created"]) {
  return {
    amp: created.gains[SHARED_GAINS],
    players: created.oscillators.slice(SHARED_OSCILLATORS + 1),
  };
}

describe("tapeKeysDevice", () => {
  test("is an instrument an agent plays by pitch", () => {
    expect(tapeKeysDevice.kind).toBe("instrument");
    expect(tapeKeysDevice.note.map((part) => part.id)).toEqual(["frequency"]);
    expect(deviceTools(tapeKeysDevice).length).toBeGreaterThan(0);
  });

  test("the speed runs up to a whole tone either way", () => {
    expect(speedCents(0)).toBe(-200);
    expect(speedCents(5)).toBe(0);
    expect(tapeKeysDevice.format("speed", 10)).toBe("+200 ct");
  });
});

describe("createTapeKeysEngine", () => {
  test("starts its output at its volume", () => {
    const { created, ctx } = fakeContext();
    createTapeKeysEngine(ctx, { ...defaults, volume: 10 });
    expect(created.gains[1]?.gain.value).toBeCloseTo(volumeGain(10) * 2, 9);
  });

  test("the strings track plays three bows at the key's pitch, a little off as its strip is", () => {
    const { created, ctx } = fakeContext();
    createTapeKeysEngine(ctx, defaults).noteOn({ frequency: C4 }, { at: 3 });
    const { players } = keyOf(created);
    expect(players).toHaveLength(3);
    expect(players[0]?.frequency.sets[0]?.value).toBeCloseTo(261.63, 1);
    expect(Math.abs((players[1]?.detune.value ?? 0) - 0)).toBeLessThan(4);
  });

  test("the flutes track plays a sine and its octave", () => {
    const { created, ctx } = fakeContext();
    createTapeKeysEngine(ctx, { ...defaults, station: "flutes" }).noteOn({
      frequency: C4,
    });
    const { players } = keyOf(created);
    expect(players.map((item) => item.type)).toEqual(["sine", "triangle"]);
  });

  test("a tape runs out after eight seconds, key down or not", () => {
    const { created, ctx } = fakeContext();
    createTapeKeysEngine(ctx, defaults).noteOn({ frequency: C4 }, { at: 3 });
    const { amp, players } = keyOf(created);
    expect(amp?.gain.targets.at(-1)?.value).toBe(0);
    expect(amp?.gain.targets.at(-1)?.time).toBeCloseTo(
      3 + TAPE_SECONDS - 0.05,
      9
    );
    expect(players[0]?.stopped[0]).toBeCloseTo(3 + TAPE_SECONDS + 0.05, 9);
  });

  test("a key let go fades at once, and its tape stops soon after", () => {
    const { created, ctx } = fakeContext();
    const engine = createTapeKeysEngine(ctx, defaults);
    engine.noteOn({ frequency: C4 }, { at: 3, id: "a" });
    engine.noteOff({ at: 4, id: "a" });
    const { amp, players } = keyOf(created);
    expect(amp?.gain.sets.at(-1)?.time).toBe(4);
    expect(amp?.gain.sets.at(-1)?.value).toBeGreaterThan(0);
    expect(amp?.gain.targets.at(-1)).toEqual({ tau: 0.05, time: 4, value: 0 });
    expect(players[0]?.stopped.at(-1)).toBeCloseTo(4.4, 9);
  });

  test("a pitch outside the 35 keys plays nothing", () => {
    const { created, ctx } = fakeContext();
    createTapeKeysEngine(ctx, defaults).noteOn({ frequency: 55 });
    expect(created.oscillators).toHaveLength(SHARED_OSCILLATORS);
  });

  test("a note off that names another note lets nothing go", () => {
    const { created, ctx } = fakeContext();
    const engine = createTapeKeysEngine(ctx, defaults);
    engine.noteOn({ frequency: C4 }, { id: "a" });
    engine.noteOff({ id: "b" });
    expect(keyOf(created).players[0]?.stopped).toHaveLength(1);
  });

  test("the speed bends every key held through the capstan", () => {
    const { created, ctx } = fakeContext();
    const engine = createTapeKeysEngine(ctx, defaults);
    engine.noteOn({ frequency: C4 });
    engine.update({ ...defaults, speed: 10 });
    expect(created.constants[0]?.offset.targets.at(-1)?.value).toBe(200);
  });
});
