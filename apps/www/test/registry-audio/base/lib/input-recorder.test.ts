import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createInputRecorder } from "@/registry-audio/bases/base/lib/input-recorder";

/** The recorder's node: what it was told, and a way to answer as its processor does. */
interface FakeNode {
  answer: (data: unknown) => void;
  told: unknown[];
}

let nodes: FakeNode[] = [];
const original = globalThis.AudioWorkletNode;

beforeEach(() => {
  nodes = [];
  class FakeAudioWorkletNode {
    port = {
      close: () => undefined,
      onmessage: null as ((event: { data: unknown }) => void) | null,
      postMessage: (data: unknown) => {
        this.fake.told.push(data);
      },
    };
    fake: FakeNode = {
      answer: (data) => this.port.onmessage?.({ data }),
      told: [],
    };
    constructor() {
      nodes.push(this.fake);
    }
    disconnect() {
      // Nothing to let go of.
    }
  }
  Object.assign(globalThis, { AudioWorkletNode: FakeAudioWorkletNode });
});

afterEach(() => {
  Object.assign(globalThis, { AudioWorkletNode: original });
});

/** A context that loads any worklet, a new one per test so nothing is cached. */
const context = () =>
  ({
    audioWorklet: { addModule: () => Promise.resolve() },
  }) as unknown as BaseAudioContext;

const block = { channels: [new Float32Array(4)], frame: 128 };

describe("createInputRecorder", () => {
  test("a second stop before the processor answers gives the same blocks", async () => {
    const recorder = await createInputRecorder(context());
    const [node] = nodes;
    if (!(recorder && node)) {
      throw new Error("no recorder");
    }
    recorder.start();
    node.answer(block);
    const first = recorder.stop();
    const second = recorder.stop();
    node.answer({ stopped: true });
    expect(await first).toEqual([block]);
    expect(await second).toEqual([block]);
    // The processor is told to stop once.
    expect(node.told.filter((message) => message === "stop")).toHaveLength(1);
  });

  test("disposed while it stops, it still gives what it kept", async () => {
    const recorder = await createInputRecorder(context());
    const [node] = nodes;
    if (!(recorder && node)) {
      throw new Error("no recorder");
    }
    recorder.start();
    node.answer(block);
    const stopping = recorder.stop();
    recorder.dispose();
    expect(await stopping).toEqual([block]);
  });
});
