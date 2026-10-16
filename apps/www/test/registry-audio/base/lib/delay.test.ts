import { describe, expect, test } from "bun:test";
import {
  delayDevice,
  delaySeconds,
  delaySettings,
  delayTaps,
  MAX_DELAY_SECONDS,
  nearestDivision,
} from "@/registry-audio/bases/base/lib/delay-device";
import { createDelayEngine } from "@/registry-audio/bases/base/lib/delay-engine";

class FakeParam {
  value = 0;
  readonly targets: { ramp: number; value: number }[] = [];
  setTargetAtTime(value: number, _time: number, ramp: number) {
    this.targets.push({ ramp, value });
    return this;
  }
}
class FakeNode {
  readonly connections: unknown[] = [];
  disconnected = 0;
  connect<T>(destination: T): T {
    this.connections.push(destination);
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
  max = 0;
}
class FakeFilter extends FakeNode {
  readonly frequency = new FakeParam();
  type = "";
}

function fakeContext() {
  const made = {
    delay: new FakeDelay(),
    filter: new FakeFilter(),
    gains: [] as FakeGain[],
  };
  const ctx = {
    createBiquadFilter: () => made.filter,
    createDelay: (max: number) => {
      made.delay.max = max;
      return made.delay;
    },
    createGain: () => {
      const gain = new FakeGain();
      made.gains.push(gain);
      return gain;
    },
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const defaults = delayDevice.defaults();

describe("the delay device", () => {
  test("its settings are the numbers for the nodes, in seconds and shares", () => {
    const settings = delaySettings({
      ...defaults,
      feedback: 60,
      mix: 25,
      timeMs: 500,
    });
    expect(settings.delay).toBe(0.5);
    expect(settings.feedback).toBeCloseTo(0.6, 6);
    expect(settings.dry).toBeCloseTo(0.75, 6);
    expect(settings.wet).toBeCloseTo(0.25, 6);
  });

  test("off, nothing is echoed and nothing comes back", () => {
    const settings = delaySettings({ ...defaults, enabled: false });
    expect(settings.wet).toBe(0);
    expect(settings.feedback).toBe(0);
    expect(settings.dry).toBe(1);
  });

  test("the taps are the dry sound, then each echo a feedback share quieter", () => {
    const taps = delayTaps(
      { ...defaults, feedback: 50, mix: 40, timeMs: 400 },
      3000
    );
    expect(taps[0]).toEqual({ level: 0.6, timeMs: 0 });
    expect(taps[1]).toEqual({ level: 0.4, timeMs: 400 });
    expect(taps[2]?.level).toBeCloseTo(0.2, 6);
    expect(taps[2]?.timeMs).toBe(800);
    // Each tap is at a multiple of the time and none lies past the window.
    expect(taps.every((tap) => tap.timeMs <= 3000)).toBe(true);
  });

  test("no feedback is one echo, and a tap too faint to see is left out", () => {
    expect(
      delayTaps({ ...defaults, feedback: 0, timeMs: 400 }, 3000)
    ).toHaveLength(2);
    const faint = delayTaps({ ...defaults, feedback: 95, timeMs: 10 }, 3000);
    expect(faint.every((tap) => tap.level >= 0.3 * 0.03)).toBe(true);
  });

  test("an agent asking for a feedback of 100 is brought in below runaway", () => {
    const applied = delayDevice.apply(defaults, { feedback: 100 });
    expect(applied.state.feedback).toBe(95);
    expect(applied.changes[0]?.adjusted).toBe(true);
  });
});

describe("createDelayEngine", () => {
  test("the delay node holds the longest time the device allows", () => {
    const { ctx, made } = fakeContext();
    createDelayEngine(ctx, defaults);
    expect(made.delay.max).toBeGreaterThanOrEqual(MAX_DELAY_SECONDS);
  });

  test("starts the nodes at the first state, not at their own defaults", () => {
    const { ctx, made } = fakeContext();
    createDelayEngine(ctx, { ...defaults, timeMs: 250, toneHz: 2000 });
    expect(made.delay.delayTime.value).toBe(0.25);
    expect(made.filter.frequency.value).toBe(2000);
    expect(made.filter.type).toBe("lowpass");
  });

  test("an update ramps every parameter, the time slower than the rest", () => {
    const { ctx, made } = fakeContext();
    const engine = createDelayEngine(ctx, defaults);
    engine.update({ ...defaults, timeMs: 600 });
    const [time] = made.delay.delayTime.targets;
    expect(time?.value).toBe(0.6);
    expect(time?.ramp).toBeGreaterThan(
      made.filter.frequency.targets[0]?.ramp ?? 1
    );
  });

  test("off, the echo goes silent and the feedback to zero", () => {
    const { ctx, made } = fakeContext();
    const engine = createDelayEngine(ctx, defaults);
    engine.update({ ...defaults, enabled: false });
    const targets = made.gains.flatMap((gain) =>
      gain.gain.targets.map((t) => t.value)
    );
    expect(
      targets.filter((value) => value === 0).length
    ).toBeGreaterThanOrEqual(2);
  });

  test("dispose lets go of every node", () => {
    const { ctx, made } = fakeContext();
    createDelayEngine(ctx, defaults).dispose();
    expect(made.gains.every((gain) => gain.disconnected === 1)).toBe(true);
    expect(made.delay.disconnected).toBe(1);
  });
});

describe("a delay synced to the tempo", () => {
  const tempo = { beatsPerBar: 4, beatUnit: 4, bpm: 120 };
  const synced = { ...defaults, division: "1/8d", sync: true, timeMs: 777 };

  test("the time is the note value at the tempo, the milliseconds ignored", () => {
    expect(delaySeconds(synced, tempo)).toBeCloseTo(0.375, 9);
    expect(delaySeconds({ ...synced, sync: false }, tempo)).toBeCloseTo(
      0.777,
      9
    );
    expect(delaySettings(synced, { ...tempo, bpm: 60 }).delay).toBeCloseTo(
      0.75,
      9
    );
  });

  test("a note longer than the node holds is held to what it can", () => {
    const slow = { ...tempo, bpm: 30 };
    expect(
      delaySeconds({ ...defaults, division: "1/1", sync: true }, slow)
    ).toBe(MAX_DELAY_SECONDS);
  });

  test("the taps follow the tempo", () => {
    const taps = delayTaps({ ...synced, feedback: 50, mix: 100 }, 3000, tempo);
    expect(taps[1]?.timeMs).toBeCloseTo(375, 6);
    expect(taps[2]?.timeMs).toBeCloseTo(750, 6);
  });

  test("a time dragged to lands on the nearest note value", () => {
    expect(nearestDivision(0.5, tempo)).toBe("1/4");
    expect(nearestDivision(0.37, tempo)).toBe("1/8d");
    expect(nearestDivision(0.26, tempo)).toBe("1/8");
  });

  test("the engine reads the tempo it was given and the one an update brings", () => {
    const { ctx, made } = fakeContext();
    const engine = createDelayEngine(ctx, synced, { tempo });
    expect(made.delay.delayTime.value).toBeCloseTo(0.375, 9);
    engine.update(synced, { tempo: { ...tempo, bpm: 60 } });
    expect(made.delay.delayTime.targets.at(-1)?.value).toBeCloseTo(0.75, 9);
    // An update with no context keeps the last tempo.
    engine.update(synced);
    expect(made.delay.delayTime.targets.at(-1)?.value).toBeCloseTo(0.75, 9);
  });

  test("an agent can pick a note value, and a made-up one is refused by name", () => {
    expect(
      delayDevice.apply(defaults, { division: "1/16t" }).state.division
    ).toBe("1/16t");
    expect(delayDevice.apply(defaults, { division: "1/7" }).rejected).toEqual([
      { id: "division", reason: "not one of the options" },
    ]);
  });
});
