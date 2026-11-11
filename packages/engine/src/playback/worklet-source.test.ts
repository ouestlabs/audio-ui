import { afterAll, describe, expect, test } from "bun:test";
import { BUNDLES, inputsHash } from "../../scripts/worklet.ts";
import { playedClip } from "./clip.ts";
import { RECORDING_LOADER_WORKER_INPUTS } from "./loader-worker-source.ts";
import { CLIP_PLAYER_PROCESSOR, type ClipPlayerMessage } from "./protocol.ts";
import { createPagePool, createRecordingStream, PageCache } from "./stream.ts";
import {
  CLIP_PLAYER_WORKLET,
  CLIP_PLAYER_WORKLET_INPUTS,
} from "./worklet-source.ts";

interface FakeProcessor {
  port: { onmessage: ((event: { data: ClipPlayerMessage }) => void) | null };
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
}

/** Runs the shipped source as an AudioWorkletGlobalScope would, and returns the processor class it registers. */
function loadShippedWorklet(rate: number) {
  const registered = new Map<string, new () => FakeProcessor>();
  const scope = globalThis as Record<string, unknown>;
  scope.sampleRate = rate;
  scope.currentFrame = 0;
  scope.registerProcessor = (
    name: string,
    processor: new () => FakeProcessor
  ) => registered.set(name, processor);
  scope.AudioWorkletProcessor = class {
    port = { onmessage: null, postMessage: () => undefined };
  };
  new Function(CLIP_PLAYER_WORKLET)();
  return registered;
}

afterAll(() => {
  const scope = globalThis as Record<string, unknown>;
  for (const name of [
    "sampleRate",
    "currentFrame",
    "registerProcessor",
    "AudioWorkletProcessor",
  ]) {
    delete scope[name];
  }
});

describe("the shipped worklet", () => {
  test("is bundled from the sources as they are, with the loader: run `bun run worklet:build` after changing them", async () => {
    const [worklet, loader] = await Promise.all(
      BUNDLES.map(({ entry }) => inputsHash(entry))
    );
    expect(worklet).toBe(CLIP_PLAYER_WORKLET_INPUTS);
    expect(loader).toBe(RECORDING_LOADER_WORKER_INPUTS);
  });

  test("CLP-001: plays a recording bit-identical, through the source a context loads", () => {
    const rate = 48_000;
    const Processor = loadShippedWorklet(rate).get(CLIP_PLAYER_PROCESSOR);
    expect(Processor).toBeDefined();
    if (!Processor) {
      return;
    }
    const player = new Processor();
    const send = (data: ClipPlayerMessage) => player.port.onmessage?.({ data });
    const left = Float32Array.from({ length: 1024 }, (_, index) =>
      Math.sin(index / 7)
    );
    const right = Float32Array.from({ length: 1024 }, (_, index) =>
      Math.cos(index / 5)
    );
    send({
      channels: [left, right],
      id: "take",
      sampleRate: rate,
      type: "recording",
    });
    send({
      clips: [
        playedClip(
          {
            sourceLength: 1024 / rate,
            value: {
              fadeIn: 0,
              fadeOut: 0,
              length: 512 / rate,
              offset: 100 / rate,
              start: 128 / rate,
            },
          },
          "take",
          rate
        ),
      ],
      type: "clips",
    });
    send({
      state: { at: 0, loop: null, playing: true, position: 0 },
      type: "state",
    });
    const outLeft = new Float32Array(1024);
    const outRight = new Float32Array(1024);
    const scope = globalThis as Record<string, unknown>;
    for (let frame = 0; frame < 1024; frame += 128) {
      scope.currentFrame = frame;
      expect(
        player.process(
          [],
          [
            [
              outLeft.subarray(frame, frame + 128),
              outRight.subarray(frame, frame + 128),
            ],
          ]
        )
      ).toBe(true);
    }
    expect(outLeft.slice(128, 640)).toEqual(left.slice(100, 612));
    expect(outRight.slice(128, 640)).toEqual(right.slice(100, 612));
    expect(outLeft[127]).toBe(0);
    expect(outLeft[640]).toBe(0);
    send({ type: "dispose" });
    expect(
      player.process([], [[new Float32Array(128), new Float32Array(128)]])
    ).toBe(false);
  });

  test("G-013: plays a streamed recording, once its pages are in the pool it shares", () => {
    const rate = 48_000;
    const Processor = loadShippedWorklet(rate).get(CLIP_PLAYER_PROCESSOR);
    if (!Processor) {
      throw new Error("the worklet registers its processor");
    }
    const player = new Processor();
    const send = (data: ClipPlayerMessage) => player.port.onmessage?.({ data });
    const channels = [0, 1].map((channel) =>
      Float32Array.from({ length: 1024 }, (_, index) =>
        Math.sin(index / (7 + channel))
      )
    );
    const pool = createPagePool(4, { pageFrames: 256 });
    const stream = createRecordingStream(pool, 2, 1024);
    const cache = new PageCache(pool, (_id, page, views) => {
      for (const [channel, view] of views.entries()) {
        view.set(
          (channels[channel] as Float32Array).subarray(
            page * 256,
            page * 256 + 256
          )
        );
      }
    });
    cache.add("take", stream);
    cache.want([0, 1, 2, 3].map((page) => ({ page, recording: "take" })));
    send({ id: "take", sampleRate: rate, stream, type: "stream" });
    send({
      clips: [
        playedClip(
          {
            sourceLength: 1024 / rate,
            value: {
              fadeIn: 0,
              fadeOut: 0,
              length: 1024 / rate,
              offset: 0,
              start: 0,
            },
          },
          "take",
          rate
        ),
      ],
      type: "clips",
    });
    send({
      state: { at: 0, loop: null, playing: true, position: 0 },
      type: "state",
    });
    const out = [new Float32Array(1024), new Float32Array(1024)];
    const scope = globalThis as Record<string, unknown>;
    for (let frame = 0; frame < 1024; frame += 128) {
      scope.currentFrame = frame;
      player.process(
        [],
        [out.map((data) => data.subarray(frame, frame + 128))]
      );
    }
    expect(out).toEqual(channels);
  });
});
