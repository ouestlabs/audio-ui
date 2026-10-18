import { describe, expect, test } from "bun:test";
import {
  createPpmBallistics,
  createVuBallistics,
  FLOOR_DB,
} from "./ballistics.ts";

/** Steps a meter through `seconds` in frames of `frame` seconds, toward `level`. */
function run(
  meter: ReturnType<typeof createVuBallistics>,
  level: number,
  seconds: number,
  frame = 1 / 60
) {
  for (let elapsed = 0; elapsed < seconds; elapsed += frame) {
    meter.step(level, frame);
  }
  return meter.value;
}

describe("VU ballistics", () => {
  test("reaches 99% of a step in 300 ms", () => {
    const meter = createVuBallistics();
    meter.reset(FLOOR_DB);
    const target = -6;
    const after = run(meter, target, 0.3);
    const reached = (after - FLOOR_DB) / (target - FLOOR_DB);
    expect(reached).toBeGreaterThan(0.98);
    expect(reached).toBeLessThan(1);
  });

  test("falls as slowly as it rises", () => {
    const up = createVuBallistics();
    up.reset(FLOOR_DB);
    run(up, -6, 1);
    const down = createVuBallistics();
    down.reset(-6);
    const fallen = run(down, FLOOR_DB, 0.3);
    expect(fallen).toBeGreaterThan(-6 - 60 * 0.9);
  });

  test("keeps the reading between the level it follows and where it started", () => {
    const meter = createVuBallistics();
    meter.reset(-20);
    for (let i = 0; i < 1000; i += 1) {
      const value = meter.step(-3, 1 / 60);
      expect(value).toBeGreaterThanOrEqual(-20);
      expect(value).toBeLessThanOrEqual(-3);
    }
  });
});

describe("PPM ballistics", () => {
  test("rises almost at once", () => {
    const meter = createPpmBallistics();
    meter.reset(FLOOR_DB);
    expect(run(meter, -3, 0.05)).toBeGreaterThan(-3 - 0.5);
  });

  test("falls at a steady rate, 20 dB in 1.5 seconds", () => {
    const meter = createPpmBallistics();
    meter.reset(-3);
    const fallen = run(meter, FLOOR_DB, 0.75);
    expect(fallen).toBeCloseTo(-3 - 10, 0);
  });

  test("does not fall below the level it follows", () => {
    const meter = createPpmBallistics();
    meter.reset(-3);
    expect(run(meter, -10, 10)).toBe(-10);
  });
});
