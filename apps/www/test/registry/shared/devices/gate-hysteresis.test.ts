import { describe, expect, test } from "bun:test";
import { gate } from "@audio/dynamics-gate/audio";
import {
  GATE_WORKLET,
  gateDevice,
  gateSettings,
} from "@/registry/bases/shared/devices/gate/device";
import { MANIFEST_HOST } from "@/registry/lib/devices/manifest-worklet";
import { madeProcessor, published } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = gateDevice.defaults();
const hysteresis = defaults;

/** Bursts of a sine over the threshold, a quiet tail between: what a gate opens and closes on. */
const bursts = (start: number) =>
  [0, 1].map(
    () =>
      new Float32Array(BLOCK).map((_, frame) => {
        const at = start + frame;
        const loud = Math.floor(at / 4800) % 2 === 0;
        return (loud ? 0.5 : 0.01) * Math.sin((2 * Math.PI * 440 * at) / RATE);
      }) as Float32Array
  );

const parametersOf = (state = hysteresis) =>
  Object.fromEntries(
    Object.entries(gateSettings(state).modelParams).map(([name, value]) => [
      name,
      Float32Array.of(value),
    ])
  );

describe("the gate's hysteresis model", () => {
  test("plays the processor of @audio/dynamics-gate as published, sample for sample", () => {
    for (const lookaheadMs of [0, 5]) {
      const state = { ...hysteresis, lookaheadMs };
      const { processor } = madeProcessor(GATE_WORKLET, "noise", RATE);
      const params = parametersOf(state);
      const reference = published(gate, params);
      const run = gate({
        ...MANIFEST_HOST,
        maxBlockSize: BLOCK,
        maxChannels: 2,
        params: reference,
        sampleRate: RATE,
      });
      let worst = 0;
      for (let block = 0; block < 200; block += 1) {
        const input = bursts(block * BLOCK);
        const expected = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
        run([input], [expected], reference);
        const out = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
        processor.process([input], [out], params);
        for (const channel of [0, 1] as const) {
          for (let frame = 0; frame < BLOCK; frame += 1) {
            worst = Math.max(
              worst,
              Math.abs(
                (out[channel]?.[frame] ?? 0) - (expected[channel]?.[frame] ?? 0)
              )
            );
          }
        }
      }
      expect({ lookaheadMs, worst }).toEqual({ lookaheadMs, worst: 0 });
    }
  });

  test("a key on the sidechain opens and closes it in place of the signal, as the published processor does", () => {
    const { processor } = madeProcessor(GATE_WORKLET, "noise", RATE);
    // A short release, so it is shut well within a silence of the key.
    const params = parametersOf({ ...hysteresis, holdMs: 10, releaseMs: 20 });
    const reference = published(gate, params);
    const run = gate({
      ...MANIFEST_HOST,
      maxBlockSize: BLOCK,
      maxChannels: 2,
      params: reference,
      sampleRate: RATE,
    });
    // A steady quiet signal, opened only while the key bursts.
    const quiet = (start: number) =>
      [0, 1].map(
        () =>
          new Float32Array(BLOCK).map(
            (_, frame) =>
              0.01 * Math.sin((2 * Math.PI * 110 * (start + frame)) / RATE)
          ) as Float32Array
      );
    let worst = 0;
    let open = 0;
    let shut = 0;
    for (let block = 0; block < 200; block += 1) {
      const input = quiet(block * BLOCK);
      // Bursts of a kick-like sine, silence between.
      const key = bursts(block * BLOCK).map((channel) =>
        channel.map((sample, frame) =>
          Math.floor((block * BLOCK + frame) / 4800) % 2 === 0 ? sample : 0
        )
      );
      const expected = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
      run([input, key], [expected], reference);
      const left = new Float32Array(BLOCK);
      const out = [left, new Float32Array(BLOCK)];
      processor.process([input, key], [out], params);
      const loudest = Math.max(...left.map(Math.abs));
      if (Math.floor((block * BLOCK) / 4800) % 2 === 0) {
        open = Math.max(open, loudest);
      } else if ((block * BLOCK) % 4800 > 4200) {
        shut = Math.max(shut, loudest);
      }
      for (const channel of [0, 1] as const) {
        for (let frame = 0; frame < BLOCK; frame += 1) {
          worst = Math.max(
            worst,
            Math.abs(
              (out[channel]?.[frame] ?? 0) - (expected[channel]?.[frame] ?? 0)
            )
          );
        }
      }
    }
    expect(worst).toBe(0);
    // Open while the key plays, at the floor once it has stopped.
    expect(open).toBeGreaterThan(0.009);
    expect(shut).toBeLessThan(0.001);
  });

  test("takes a sidechain", () => {
    expect(gateDevice.describe().sidechain).toBe(true);
  });

  test("closes the hysteresis under the threshold, its floor the range", () => {
    const settings = gateSettings({
      ...hysteresis,
      floorDb: -50,
      hysteresisDb: 10,
      thresholdDb: -30,
    });
    expect(settings.modelParams).toMatchObject({
      closeThreshold: -40,
      range: -50,
      threshold: -30,
    });
    expect(
      gateSettings({ ...hysteresis, enabled: false }).modelParams
    ).toMatchObject({
      lookahead: 0,
      range: 0,
    });
  });

  test("the latency is the look-ahead", () => {
    const state = { ...hysteresis, lookaheadMs: 4 };
    expect(gateDevice.latency(state, RATE)).toBe(
      gate.latency({ params: { lookahead: [4] }, sampleRate: RATE } as never) /
        RATE
    );
  });
});
