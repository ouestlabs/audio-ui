import { describe, expect, test } from "bun:test";
import { compressorDevice } from "@/registry-audio/bases/base/devices/compressor/device";
import { createCompressorEngine } from "@/registry-audio/bases/base/devices/compressor/engine";

class FakeParam {
  value = 0;
  readonly targets: { time: number; timeConstant: number; value: number }[] =
    [];
  setTargetAtTime(value: number, time: number, timeConstant: number) {
    this.targets.push({ time, timeConstant, value });
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
function fakeContext() {
  const created = { gains: [] as FakeGain[] };
  const ctx = {
    createGain: () => {
      const gain = new FakeGain();
      created.gains.push(gain);
      return gain;
    },
    currentTime: 1.5,
  };
  return { created, ctx: ctx as unknown as BaseAudioContext };
}

const defaults = compressorDevice.defaults();

describe("createCompressorEngine", () => {
  test("passes the signal unchanged until the models are ready, and reads no reduction", async () => {
    const { created, ctx } = fakeContext();
    const engine = createCompressorEngine(ctx, { ...defaults, mix: 50 });
    // input, output, dry, model trim, wet
    const [, , dry, , wet] = created.gains;
    expect(dry?.gain.value).toBe(1);
    expect(wet?.gain.value).toBe(0);
    expect(await engine.ready).toBe(false);
    expect(engine.reduction).toBe(0);
  });

  test("releases every node it made", () => {
    const { created, ctx } = fakeContext();
    const engine = createCompressorEngine(ctx, defaults);
    engine.update({ ...defaults, ratio: 10 });
    engine.dispose();
    for (const node of created.gains) {
      expect(node.disconnected).toBeGreaterThan(0);
    }
  });
});
