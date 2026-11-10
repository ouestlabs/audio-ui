import { describe, expect, test } from "bun:test";
import {
  DELAY_WORKLET,
  delayDevice,
  delaySeconds,
  delaySettings,
  delayTaps,
  MAX_DELAY_SECONDS,
  multitapTaps,
  nearestDivision,
} from "@/registry-audio/bases/base/devices/delay/device";
import { createDelayEngine } from "@/registry-audio/bases/base/devices/delay/engine";

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

describe("the delay's modes", () => {
  test("an echo, a ping-pong, a multitap and a grain delay, the echo the one a delay starts with", () => {
    const mode = delayDevice.parameters.find(
      (parameter) => parameter.id === "mode"
    );
    expect(mode?.options?.map((option) => option.value)).toEqual([
      "echo",
      "pingpong",
      "multitap",
      "grain",
    ]);
    expect(defaults.mode).toBe("echo");
    // A delay saved before the modes plays as it did.
    expect(delayDevice.sanitize({ timeMs: 500 }).mode).toBe("echo");
  });

  test("the grain delay's settings are in seconds and semitones", () => {
    const settings = delaySettings({
      ...defaults,
      grainMs: 120,
      jitter: 3,
      mode: "grain",
      pitch: 7,
      sprayMs: 40,
    });
    expect(settings).toMatchObject({
      grain: 0.12,
      jitter: 3,
      mode: "grain",
      pitch: 7,
      spray: 0.04,
    });
  });

  test("a multitap's taps are half the time at half the level and the whole time at three tenths", () => {
    expect(multitapTaps(0.4)).toEqual([
      { gain: 0.5, time: 0.2 },
      { gain: 0.3, time: 0.4 },
    ]);
  });

  test("a multitap's echoes fall every half time, its two taps and what they send back", () => {
    const taps = delayTaps(
      { ...defaults, feedback: 50, mix: 100, mode: "multitap", timeMs: 400 },
      1000
    );
    expect(taps.slice(1, 3)).toEqual([
      { level: 0.5, timeMs: 200 },
      // The far tap, and the near one reading what the first echo sent back.
      { level: 0.3 + 0.5 * 0.5 * 0.5, timeMs: 400 },
    ]);
  });
});

describe("the delay's worklet", () => {
  interface Processor {
    line: { mode: string; time: number } | null;
    port: { onmessage: (event: { data: unknown }) => void };
    process: (
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ) => boolean;
  }
  const RATE = 8000;
  const made = (mode: string) => {
    class AudioWorkletProcessor {
      readonly port: { onmessage: (event: { data: unknown }) => void } = {
        onmessage: () => undefined,
      };
    }
    let Made: (new (options: unknown) => Processor) | undefined;
    new Function(
      "AudioWorkletProcessor",
      "registerProcessor",
      "sampleRate",
      DELAY_WORKLET
    )(
      AudioWorkletProcessor,
      (_name: string, processor: new (options: unknown) => Processor) => {
        Made = processor;
      },
      RATE
    );
    if (!Made) {
      throw new Error("The worklet registered no processor");
    }
    return new Made({ processorOptions: { mode } });
  };
  const parameters = (time: number, feedback = 0.5) => ({
    feedback: new Float32Array([feedback]),
    grain: new Float32Array([0.04]),
    jitter: new Float32Array([0]),
    pitch: new Float32Array([0]),
    spray: new Float32Array([0]),
    time: new Float32Array([time]),
  });
  /** A click at the start, then silence: each side's sound, block after block. */
  const ring = (processor: Processor, blocks: number, time: number) => {
    const sides: [number[], number[]] = [[], []];
    for (let block = 0; block < blocks; block += 1) {
      const input = new Float32Array(128);
      if (block === 0) {
        input[0] = 1;
      }
      const output = [new Float32Array(128), new Float32Array(128)];
      processor.process([[input]], [output], parameters(time));
      sides[0].push(...output[0]);
      sides[1].push(...output[1]);
    }
    return sides;
  };

  test("a ping-pong's echoes bounce: the first on the left, the next on the right", () => {
    const [left = [], right = []] = ring(made("pingpong"), 20, 0.1);
    // A tenth of a second at 8 kHz is 800 frames.
    expect(left[800]).toBeCloseTo(1, 6);
    expect(right[800]).toBeCloseTo(0, 6);
    expect(right[1600]).toBeCloseTo(0.5, 6);
    expect(left[1600]).toBeCloseTo(0, 6);
  });

  test("a multitap plays its taps alone, the sound itself left to the dry path", () => {
    const [left = []] = ring(made("multitap"), 10, 0.1);
    expect(left[0]).toBeCloseTo(0, 6);
    expect(left[400]).toBeCloseTo(0.5, 6);
    expect(left[800]).toBeCloseTo(0.3 + 0.5 * 0.5 * 0.5, 6);
  });

  test("a grain delay plays the package's grains, its line made long ahead", async () => {
    const { default: graindelay } = await import("@audio/effect-graindelay");
    const [left = []] = ring(made("grain"), 30, 0.1);
    const input = new Float32Array(30 * 128);
    input[0] = 1;
    // As the parameters reach it: in 32 bits.
    const expected = graindelay(input, {
      feedback: Math.fround(0.5),
      fs: RATE,
      grain: Math.fround(0.04),
      jitter: 0,
      mix: 1,
      pitch: 0,
      seed: 0x9e_37_79_b9,
      spray: 0,
      time: Math.fround(0.1),
    });
    let peak = 0;
    for (const [frame, sample] of left.entries()) {
      peak = Math.max(peak, Math.abs(sample));
      expect(sample).toBeCloseTo(expected[frame] ?? 0, 6);
    }
    expect(peak).toBeGreaterThan(0.1);
  });

  test("a ping-pong takes a new time once the knob has rested, not while it moves", () => {
    const processor = made("pingpong");
    const block = () => [new Float32Array(128), new Float32Array(128)];
    processor.process([[new Float32Array(128)]], [block()], parameters(0.1));
    // A knob turning: a new time every block.
    for (let step = 1; step <= 10; step += 1) {
      processor.process(
        [[new Float32Array(128)]],
        [block()],
        parameters(0.1 + step * 0.01)
      );
    }
    expect(processor.line?.time).toBeCloseTo(0.1, 6);
    // At rest: 0.12 s at 8 kHz is under eight blocks.
    for (let step = 0; step < 9; step += 1) {
      processor.process([[new Float32Array(128)]], [block()], parameters(0.2));
    }
    expect(processor.line?.time).toBeCloseTo(0.2, 6);
  });

  test("its echoes ring on once the sound has stopped coming in, until they are quiet", () => {
    const processor = made("pingpong");
    const click = new Float32Array(128);
    click[0] = 1;
    processor.process(
      [[click]],
      [[new Float32Array(128), new Float32Array(128)]],
      parameters(0.1, 0)
    );
    // The source has ended: its input has no channel at all.
    const heard: number[] = [];
    for (let block = 1; block < 10; block += 1) {
      const output = [new Float32Array(128), new Float32Array(128)];
      processor.process([[]], [output], parameters(0.1, 0));
      heard.push(...output[0]);
    }
    // 800 frames in, the first 128 played before the source ended.
    expect(heard[800 - 128]).toBeCloseTo(1, 6);
  });

  test("a message picks another mode", () => {
    const processor = made("pingpong");
    processor.process(
      [[new Float32Array(128)]],
      [[new Float32Array(128), new Float32Array(128)]],
      parameters(0.1)
    );
    processor.port.onmessage({ data: { mode: "grain" } });
    expect(processor.line?.mode).toBe("grain");
  });
});

describe("the delay engine's modes", () => {
  test("a context with no worklets plays the echo for every mode, and says so", async () => {
    const { ctx, made } = fakeContext();
    const engine = createDelayEngine(ctx, { ...defaults, mode: "grain" });
    expect(await engine.ready).toBe(false);
    engine.update({ ...defaults, mode: "pingpong", timeMs: 300 });
    expect(made.delay.delayTime.targets.at(-1)?.value).toBe(0.3);
  });
});
