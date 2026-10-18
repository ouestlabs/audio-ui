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

/** The voltage a level in dB stands for: a VU pointer follows it. */
const voltage = (level: number) => 10 ** (level / 20);

describe("VU ballistics", () => {
  test("first reaches 99% of a step in 300 ms", () => {
    const meter = createVuBallistics();
    meter.reset(FLOOR_DB);
    const target = voltage(-6);
    expect(voltage(run(meter, -6, 0.28, 0.001))).toBeLessThan(0.99 * target);
    expect(voltage(run(meter, -6, 0.04, 0.001))).toBeGreaterThan(0.99 * target);
  });

  test("overshoots a step by 1 to 1.5%", () => {
    const meter = createVuBallistics();
    meter.reset(FLOOR_DB);
    let peak = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      peak = Math.max(peak, voltage(meter.step(-6, 1 / 60)));
    }
    const overshoot = peak / voltage(-6) - 1;
    expect(overshoot).toBeGreaterThan(0.01);
    expect(overshoot).toBeLessThan(0.015);
  });

  test("falls as fast as it rises, and stops at the floor", () => {
    const meter = createVuBallistics();
    meter.reset(-6);
    expect(voltage(run(meter, FLOOR_DB, 0.32, 0.001))).toBeLessThan(
      0.01 * voltage(-6)
    );
    run(meter, FLOOR_DB, 2);
    expect(meter.value).toBe(FLOOR_DB);
  });

  test("keeps the reading above where it started and within 1.5% of the level it follows", () => {
    const meter = createVuBallistics();
    meter.reset(-20);
    for (let i = 0; i < 1000; i += 1) {
      const value = meter.step(-3, 1 / 60);
      expect(value).toBeGreaterThanOrEqual(-20);
      expect(voltage(value)).toBeLessThanOrEqual(voltage(-3) * 1.015);
    }
  });

  test("settles after a long pause between two frames", () => {
    const meter = createVuBallistics();
    meter.reset(FLOOR_DB);
    expect(meter.step(-6, 30)).toBeCloseTo(-6, 1);
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
