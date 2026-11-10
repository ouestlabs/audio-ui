import { describe, expect, test } from "bun:test";
import { deviceTools } from "@audio-ui/core/device";
import {
  lampCycle,
  speedHertz,
  sweepCents,
  VIBE_STAGES,
  vibeDevice,
  vibeLight,
  vibeMix,
} from "@/registry-audio/bases/base/devices/vibe/device";
import { createVibeEngine } from "@/registry-audio/bases/base/devices/vibe/engine";

class FakeParam {
  value = 0;
  readonly targets: { time: number; value: number }[] = [];
  setTargetAtTime(value: number, time: number) {
    this.targets.push({ time, value });
    return this;
  }
}
class FakeNode {
  readonly connections: unknown[] = [];
  connect<T>(destination: T): T {
    this.connections.push(destination);
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
class FakeFilter extends FakeNode {
  readonly Q = new FakeParam();
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}
class FakeOscillator extends FakeNode {
  readonly frequency = new FakeParam();
  started = false;
  waves = 0;
  setPeriodicWave() {
    this.waves += 1;
  }
  start() {
    this.started = true;
  }
  stopped = false;
  stop() {
    this.stopped = true;
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
    createGain: () => make(created.gains, new FakeGain()),
    createOscillator: () => make(created.oscillators, new FakeOscillator()),
    createPeriodicWave: () => ({}),
    createWaveShaper: () => new FakeNode(),
    currentTime: 2,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = vibeDevice.defaults();

describe("vibeDevice", () => {
  test("is an effect an agent can set", () => {
    expect(vibeDevice.kind).toBe("effect");
    expect(deviceTools(vibeDevice).length).toBeGreaterThan(0);
  });

  test("the lamp rises faster than it fades", () => {
    const light = lampCycle(512);
    const values = Array.from(light);
    const peak = values.indexOf(Math.max(...values));
    const trough = values.indexOf(Math.min(...values));
    // From the darkest point to the brightest takes less than half a turn.
    const rise = (peak - trough + 512) % 512;
    expect(rise).toBeLessThan(256);
    expect(Math.min(...values)).toBeGreaterThan(0);
  });

  test("chorus is half dry, vibrato is shifted alone, off passes untouched", () => {
    expect(vibeMix(defaults)).toEqual({ bypass: 0, dry: 0.5, wet: 0.5 });
    expect(vibeMix({ ...defaults, mode: "vibrato" })).toEqual({
      bypass: 0,
      dry: 0,
      wet: 1,
    });
    expect(vibeMix({ ...defaults, enabled: false })).toEqual({
      bypass: 1,
      dry: 0,
      wet: 0,
    });
  });

  test("the panel's light repeats at the lamp's speed", () => {
    const light = vibeLight(defaults);
    const period = 1 / speedHertz(defaults.speed);
    expect(light(0.1)).toBeCloseTo(light(0.1 + period), 1);
  });
});

describe("createVibeEngine", () => {
  test("four stages, spread wide, each moved by the lamp half its sweep on average", () => {
    const { created, ctx } = fakeContext();
    createVibeEngine(ctx, defaults);
    expect(created.filters.map((filter) => filter.frequency.value)).toEqual([
      ...VIBE_STAGES,
    ]);
    expect(created.filters[0]?.detune.value).toBe(
      sweepCents(defaults.intensity) / 2
    );
    expect(created.oscillators[0]?.frequency.value).toBe(
      speedHertz(defaults.speed)
    );
    expect(created.oscillators[0]?.started).toBe(true);
  });

  test("switched off, the sound passes untouched", () => {
    const { created, ctx } = fakeContext();
    const engine = createVibeEngine(ctx, defaults);
    engine.update({ ...defaults, enabled: false });
    // Gains: input, depth, wet, dry, bypass, volume, output.
    const [, , wet, dry, bypass] = created.gains;
    expect(wet?.gain.targets.at(-1)?.value).toBe(0);
    expect(dry?.gain.targets.at(-1)?.value).toBe(0);
    expect(bypass?.gain.targets.at(-1)?.value).toBe(1);
  });
});
