import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createFeed,
  createWorkletStage,
} from "@/registry-audio/bases/base/lib/device-engine";

class FakeParam {
  value = 0;
  readonly targets: number[] = [];
  setTargetAtTime(value: number) {
    this.targets.push(value);
    return this;
  }
}

class FakeNode {
  readonly connections: unknown[] = [];
  connect<T>(destination: T): T {
    this.connections.push(destination);
    return destination;
  }
  disconnect(destination?: unknown) {
    const at = destination ? this.connections.indexOf(destination) : -1;
    if (destination === undefined) {
      this.connections.length = 0;
    } else if (at >= 0) {
      this.connections.splice(at, 1);
    }
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

const original = globalThis.AudioWorkletNode;
beforeEach(() => {
  Object.assign(globalThis, { AudioWorkletNode: FakeNode });
});
afterEach(() => {
  Object.assign(globalThis, { AudioWorkletNode: original });
});

/** A context whose worklets load, or fail to, with the gains it made. */
function context(loads: boolean) {
  const gains: FakeGain[] = [];
  const ctx = {
    audioWorklet: {
      addModule: () =>
        loads ? Promise.resolve() : Promise.reject(new Error("no")),
    },
    createGain: () => {
      const gain = new FakeGain();
      gains.push(gain);
      return gain;
    },
    currentTime: 0,
  } as unknown as BaseAudioContext;
  return { ctx, gains };
}

describe("createWorkletStage", () => {
  test("the sound passes clean until the worklet is in the graph, then fades over to it", async () => {
    const { ctx, gains } = context(true);
    const input = new FakeNode();
    const made = new FakeNode();
    const stage = createWorkletStage(ctx, {
      input: input as unknown as AudioNode,
      make: () => made as unknown as AudioWorkletNode,
      ramp: 0.01,
      source: "/* fades over */",
    });
    const [processed, clean] = gains;
    expect([processed?.gain.value, clean?.gain.value]).toEqual([0, 1]);
    expect(stage.node).toBeNull();
    expect(await stage.ready).toBe(true);
    expect(stage.node).toBe(made as unknown as AudioWorkletNode);
    expect(input.connections).toEqual([clean, made]);
    expect(made.connections).toEqual([processed]);
    expect([processed?.gain.targets, clean?.gain.targets]).toEqual([[1], [0]]);
  });

  test("disposed before it loads, it makes no worklet; where it cannot load, it stays clean", async () => {
    const loads = context(true);
    let made = 0;
    const make = () => {
      made += 1;
      return new FakeNode() as unknown as AudioWorkletNode;
    };
    const early = createWorkletStage(loads.ctx, {
      input: new FakeNode() as unknown as AudioNode,
      make,
      ramp: 0.01,
      source: "/* disposed early */",
    });
    early.dispose();
    expect(await early.ready).toBe(false);
    const fails = context(false);
    const stuck = createWorkletStage(fails.ctx, {
      input: new FakeNode() as unknown as AudioNode,
      make,
      ramp: 0.01,
      source: "/* never loads */",
    });
    expect(await stuck.ready).toBe(false);
    expect(made).toBe(0);
    expect(fails.gains[1]?.gain.targets).toEqual([]);
  });
});

describe("createFeed", () => {
  test("connects at once, and takes the connections away only once the fade is over", async () => {
    const from = new FakeNode();
    const key = new FakeNode();
    const to = new FakeNode();
    const feed = createFeed(
      [
        [from as unknown as AudioNode, to as unknown as AudioNode, 0, 0],
        [key as unknown as AudioNode, to as unknown as AudioNode, 0, 1],
      ],
      5
    );
    feed.set(true);
    feed.set(true);
    expect([from.connections, key.connections]).toEqual([[to], [to]]);
    feed.set(false);
    expect(from.connections).toEqual([to]);
    await Bun.sleep(10);
    expect([from.connections, key.connections]).toEqual([[], []]);
  });

  test("wanted again before the release, it stays connected", async () => {
    const from = new FakeNode();
    const to = new FakeNode();
    const feed = createFeed(
      [[from as unknown as AudioNode, to as unknown as AudioNode]],
      5
    );
    feed.set(true);
    feed.set(false);
    feed.set(true);
    await Bun.sleep(10);
    expect(from.connections).toEqual([to]);
    feed.set(false);
    feed.dispose();
    await Bun.sleep(10);
    expect(from.connections).toEqual([to]);
  });
});
