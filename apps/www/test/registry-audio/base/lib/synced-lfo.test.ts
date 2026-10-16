import { describe, expect, test } from "bun:test";
import {
  autoPanDevice,
  autoPanSettings,
  autoPanSweep,
} from "@/registry-audio/bases/base/lib/auto-pan-device";
import { createAutoPanEngine } from "@/registry-audio/bases/base/lib/auto-pan-engine";
import {
  chorusDevice,
  chorusSettings,
  chorusSweep,
} from "@/registry-audio/bases/base/lib/chorus-device";
import { createChorusEngine } from "@/registry-audio/bases/base/lib/chorus-engine";
import {
  phaserDevice,
  phaserSettings,
} from "@/registry-audio/bases/base/lib/phaser-device";
import { createPhaserEngine } from "@/registry-audio/bases/base/lib/phaser-engine";
import { lfoRate } from "@/registry-audio/bases/base/lib/synced-rate";

class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
}
class FakeNode {
  connect<T>(to: T): T {
    return to;
  }
  disconnected = 0;
  disconnect() {
    this.disconnected += 1;
  }
}
class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}
class FakeOscillator extends FakeNode {
  readonly frequency = new FakeParam();
  started = 0;
  stopped = 0;
  type = "";
  start() {
    this.started += 1;
  }
  stop() {
    this.stopped += 1;
  }
}
class FakeFilter extends FakeNode {
  readonly detune = new FakeParam();
  readonly frequency = new FakeParam();
  type = "";
}
class FakePanner extends FakeNode {
  readonly pan = new FakeParam();
}
class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam();
}

function fakeContext() {
  const made = { oscillator: new FakeOscillator() };
  const ctx = {
    createBiquadFilter: () => new FakeFilter(),
    createDelay: () => new FakeDelay(),
    createGain: () => new FakeGain(),
    createOscillator: () => made.oscillator,
    createStereoPanner: () => new FakePanner(),
    currentTime: 1,
  };
  return { ctx: ctx as unknown as BaseAudioContext, made };
}

const tempo = { beatsPerBar: 4, beatUnit: 4, bpm: 120 };

describe("a rate that follows the tempo", () => {
  test("free, it is the hertz of the state; synced, one cycle per note value", () => {
    const free = { division: "1/4", rateHz: 3, sync: false };
    expect(lfoRate(free, tempo)).toBe(3);
    expect(lfoRate({ ...free, sync: true }, tempo)).toBeCloseTo(2, 9);
    expect(
      lfoRate({ ...free, division: "1/8", sync: true }, tempo)
    ).toBeCloseTo(4, 9);
    expect(
      lfoRate({ ...free, division: "1/2", sync: true }, { ...tempo, bpm: 60 })
    ).toBeCloseTo(0.5, 9);
  });

  test("a synced rate is held between a cycle in 50 s and 40 Hz", () => {
    const state = { division: "1/1d", rateHz: 1, sync: true };
    expect(lfoRate(state, { ...tempo, bpm: 5 })).toBeCloseTo(0.02, 9);
    expect(
      lfoRate({ ...state, division: "1/32t" }, { ...tempo, bpm: 300 })
    ).toBe(40);
  });

  test("all three devices read it", () => {
    const chorus = { ...chorusDevice.defaults(), division: "1/4", sync: true };
    expect(chorusSettings(chorus, tempo).rate).toBeCloseTo(2, 9);
    const phaser = { ...phaserDevice.defaults(), division: "1/2", sync: true };
    expect(phaserSettings(phaser, tempo).rate).toBeCloseTo(1, 9);
    const pan = { ...autoPanDevice.defaults(), division: "1/1", sync: true };
    expect(autoPanSettings(pan, tempo).rate).toBeCloseTo(0.5, 9);
  });

  test("the sweep a panel draws follows the tempo", () => {
    const pan = {
      ...autoPanDevice.defaults(),
      depth: 100,
      division: "1/4",
      shape: "sine" as const,
      sync: true,
    };
    // A cycle in half a second at 120 BPM: a quarter of it, at 0.125 s, is the peak.
    expect(autoPanSweep(pan, tempo)(0.125)).toBeCloseTo(100, 6);
    const chorus = {
      ...chorusDevice.defaults(),
      delayMs: 20,
      depth: 50,
      division: "1/4",
      sync: true,
    };
    expect(chorusSweep(chorus, tempo)(0.125)).toBeCloseTo(24, 6);
  });

  test("an agent can switch it on and pick a note, and a made-up note is refused", () => {
    const changed = chorusDevice.apply(chorusDevice.defaults(), {
      division: "1/16",
      sync: true,
    });
    expect(changed.state).toMatchObject({ division: "1/16", sync: true });
    expect(
      autoPanDevice.apply(autoPanDevice.defaults(), { division: "1/9" })
        .rejected
    ).toEqual([{ id: "division", reason: "not one of the options" }]);
  });
});

describe("the engines read the tempo they are given", () => {
  const synced = { division: "1/4", sync: true };

  test("the auto pan starts on it and an update brings a new one", () => {
    const { ctx, made } = fakeContext();
    const state = { ...autoPanDevice.defaults(), ...synced };
    const engine = createAutoPanEngine(ctx, state, { tempo });
    expect(made.oscillator.frequency.value).toBeCloseTo(2, 9);
    engine.update(state, { tempo: { ...tempo, bpm: 60 } });
    expect(made.oscillator.frequency.targets.at(-1)).toBeCloseTo(1, 9);
    engine.update(state);
    expect(made.oscillator.frequency.targets.at(-1)).toBeCloseTo(1, 9);
    expect(made.oscillator.started).toBe(1);
    engine.dispose();
    expect(made.oscillator.stopped).toBe(1);
  });

  test("the chorus and the phaser too", () => {
    const chorus = fakeContext();
    const chorusState = { ...chorusDevice.defaults(), ...synced };
    const a = createChorusEngine(chorus.ctx, chorusState, { tempo });
    expect(chorus.made.oscillator.frequency.value).toBeCloseTo(2, 9);
    a.update(chorusState, { tempo: { ...tempo, bpm: 240 } });
    expect(chorus.made.oscillator.frequency.targets.at(-1)).toBeCloseTo(4, 9);
    const phaser = fakeContext();
    const phaserState = { ...phaserDevice.defaults(), ...synced };
    const b = createPhaserEngine(phaser.ctx, phaserState, { tempo });
    expect(phaser.made.oscillator.frequency.value).toBeCloseTo(2, 9);
    b.update(phaserState, { tempo: { ...tempo, bpm: 60 } });
    expect(phaser.made.oscillator.frequency.targets.at(-1)).toBeCloseTo(1, 9);
  });
});
