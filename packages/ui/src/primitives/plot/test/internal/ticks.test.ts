import { describe, expect, test } from "bun:test";
import { LINEAR_SCALE, LOGARITHMIC_SCALE } from "@audio-ui/core";
import { axisTicks, formatTick } from "../../internal/ticks";

const linear = (min: number, max: number) => ({
  max,
  min,
  scale: LINEAR_SCALE,
});
const log = (min: number, max: number) => ({
  max,
  min,
  scale: LOGARITHMIC_SCALE,
});

describe("axisTicks on a linear axis", () => {
  test("picks round steps, at 1, 2 or 5 times a power of ten", () => {
    expect(axisTicks(linear(0, 100), 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(axisTicks(linear(-18, 18), 4)).toEqual([-10, 0, 10]);
    expect(axisTicks(linear(0, 1), 4)).toEqual([0, 0.5, 1]);
  });

  test("keeps decimals clean", () => {
    expect(axisTicks(linear(0, 0.6), 6)).toEqual([
      0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6,
    ]);
  });

  test("includes zero when the range crosses it", () => {
    expect(axisTicks(linear(-60, 6), 5)).toContain(0);
  });

  test("gives nothing for an empty range", () => {
    expect(axisTicks(linear(5, 5))).toEqual([]);
  });
});

describe("axisTicks on a logarithmic axis", () => {
  test("is one tick per power of ten when that is as many as fit", () => {
    expect(axisTicks(log(20, 20_000), 6)).toEqual([100, 1000, 10_000]);
  });

  test("adds the 2 and the 5 when there is room", () => {
    expect(axisTicks(log(20, 20_000), 12)).toEqual([
      20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000,
    ]);
  });

  test("gives nothing for a range that cannot be logarithmic", () => {
    expect(axisTicks(log(0, 100))).toEqual([]);
  });
});

describe("formatTick", () => {
  test("shortens thousands and keeps small numbers plain", () => {
    expect(formatTick(1000)).toBe("1k");
    expect(formatTick(2500)).toBe("2.5k");
    expect(formatTick(20_000)).toBe("20k");
    expect(formatTick(1_500_000)).toBe("1.5M");
    expect(formatTick(-12)).toBe("-12");
    expect(formatTick(0.5)).toBe("0.5");
  });
});
