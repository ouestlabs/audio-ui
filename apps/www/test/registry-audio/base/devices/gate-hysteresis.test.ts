import { describe, expect, test } from "bun:test";
import { gate } from "@audio/dynamics-gate/audio";
import {
  GATE_HYSTERESIS_WORKLET,
  gateDevice,
  gateSettings,
  gateUnused,
} from "@/registry-audio/bases/base/devices/gate/device";
import { madeProcessor } from "./manifest-processor";

const RATE = 48_000;
const BLOCK = 128;
const defaults = gateDevice.defaults();
const hysteresis = { ...defaults, model: "hysteresis" as const };

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
      const { processor } = madeProcessor(
        GATE_HYSTERESIS_WORKLET,
        "hysteresis",
        RATE
      );
      const params = parametersOf(state);
      const run = gate({
        currentTime: 0,
        maxBlockSize: BLOCK,
        maxChannels: 2,
        params,
        sampleRate: RATE,
      });
      let worst = 0;
      for (let block = 0; block < 200; block += 1) {
        const input = bursts(block * BLOCK);
        const expected = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
        run([input], [expected], params);
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

  test("closes the hysteresis under the threshold, its floor the range, and takes no key", () => {
    const settings = gateSettings({
      ...hysteresis,
      external: true,
      floorDb: -50,
      hysteresisDb: 10,
      thresholdDb: -30,
    });
    expect(settings.modelParams).toMatchObject({
      closeThreshold: -40,
      range: -50,
      threshold: -30,
    });
    expect(settings).toMatchObject({ modelWet: 1, outerKey: 0, ownKey: 1 });
    expect(gateSettings({ ...hysteresis, enabled: false }).modelWet).toBe(0);
  });

  test("each model draws off what it does not use, and the latency is the look-ahead for both", () => {
    expect(gateUnused("clean")).toEqual(["hysteresisDb"]);
    expect(gateUnused("hysteresis")).toEqual(["external"]);
    const state = { ...hysteresis, lookaheadMs: 4 };
    expect(gateDevice.latency(state, RATE)).toBe(
      gate.latency({ params: { lookahead: [4] }, sampleRate: RATE } as never) /
        RATE
    );
    expect(gateDevice.latency({ ...state, model: "clean" }, RATE)).toBe(0.004);
  });
});
