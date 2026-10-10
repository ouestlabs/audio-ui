import { describe, expect, test } from "bun:test";
import {
  barCount,
  barLayout,
  barRect,
  bitmapLength,
  scrollShift,
} from "../../internal/bar-layout";

describe("barCount", () => {
  test("fits bars and gaps into the width, without a trailing gap", () => {
    // 3px bars, 2px gaps: 20 bars need 20×3 + 19×2 = 98px
    expect(barCount(98, 3, 2)).toBe(20);
    expect(barCount(97, 3, 2)).toBe(19);
  });

  test("always draws at least one bar, and none without a width", () => {
    expect(barCount(1, 3, 2)).toBe(1);
    expect(barCount(0, 3, 2)).toBe(0);
  });
});

describe("bitmapLength", () => {
  test("estimates from the pixel ratio when the browser reports nothing", () => {
    expect(bitmapLength(588, 2)).toBe(1176);
    expect(bitmapLength(587.6, 1.5)).toBe(881);
  });

  test("prefers the browser's exact count, a pixel away at most", () => {
    expect(bitmapLength(587.6, 1.5, 882)).toBe(882);
  });

  test("ignores a count that contradicts the pixel ratio, as under emulation", () => {
    expect(bitmapLength(588, 1, 1176)).toBe(588);
  });
});

describe("barLayout", () => {
  const layoutAt = (pixelRatio: number, barWidth = 2, barGap = 1) =>
    barLayout({
      barGap,
      barWidth,
      height: 100,
      minBarHeight: 2,
      pixelRatio,
      variant: "mirror",
      width: 300,
    });

  test("turns CSS lengths into device pixels", () => {
    expect(layoutAt(1)).toMatchObject({ barWidth: 2, count: 100, pitch: 3 });
    expect(layoutAt(2)).toMatchObject({ barWidth: 4, count: 50, pitch: 6 });
    expect(layoutAt(3)).toMatchObject({ barWidth: 6, pitch: 9 });
  });

  test("snaps to whole device pixels at fractional densities", () => {
    for (const pixelRatio of [0.9, 1.1, 1.25, 1.5, 1.75, 2.2, 2.625]) {
      const { barWidth, minBarHeight, pitch } = layoutAt(pixelRatio);
      expect(Number.isInteger(barWidth)).toBe(true);
      expect(Number.isInteger(pitch)).toBe(true);
      expect(Number.isInteger(minBarHeight)).toBe(true);
      expect(pitch).toBeGreaterThan(barWidth);
    }
  });

  test("never lets a thin bar or gap round away when zoomed out", () => {
    expect(layoutAt(0.25)).toMatchObject({ barWidth: 1, pitch: 2 });
  });

  test("keeps bars touching when there is no gap, and draws none without a width", () => {
    expect(layoutAt(2, 2, 0)).toMatchObject({ barWidth: 4, pitch: 4 });
    expect(layoutAt(2, 0).count).toBe(0);
  });
});

describe("barRect", () => {
  const layout = {
    barWidth: 3,
    count: 20,
    height: 100,
    minBarHeight: 2,
    pitch: 5,
    width: 98,
  };

  test("mirror centers the bar; bars stands it on the baseline", () => {
    const mirrored = barRect(0.5, 2, { ...layout, variant: "mirror" });
    expect(mirrored).toEqual({ height: 50, width: 3, x: 10, y: 25 });
    const standing = barRect(0.5, 2, { ...layout, variant: "bars" });
    expect(standing).toEqual({ height: 50, width: 3, x: 10, y: 50 });
  });

  test("line centers its points like mirror", () => {
    expect(barRect(0.5, 2, { ...layout, variant: "line" }).y).toBe(25);
  });

  test("shift moves the whole row", () => {
    expect(barRect(0.5, 2, { ...layout, variant: "mirror" }, -4).x).toBe(6);
  });

  test("lands every edge on a whole pixel, whatever the level", () => {
    for (const level of [0.013, 0.337, 0.5049, 0.871]) {
      const rect = barRect(level, 7, { ...layout, variant: "mirror" });
      expect(Number.isInteger(rect.y)).toBe(true);
      expect(Number.isInteger(rect.height)).toBe(true);
    }
  });

  test("silence still draws a sliver", () => {
    expect(barRect(0, 0, { ...layout, variant: "mirror" }).height).toBe(2);
  });

  test("a full-scale bar fills the height", () => {
    const rect = barRect(1, 0, { ...layout, variant: "mirror" });
    expect(rect).toMatchObject({ height: 100, y: 0 });
  });
});

describe("scrollShift", () => {
  const layout = {
    barWidth: 4,
    count: 10,
    height: 100,
    minBarHeight: 2,
    pitch: 6,
    variant: "mirror" as const,
    width: 61,
  };

  test("a settled row ends flush with the right edge", () => {
    // 11 bars: the last one starts at 61 - 4 = 57, so the first at 57 - 60 = -3
    expect(scrollShift(11, 1, layout)).toBe(-3);
    expect(barRect(1, 10, layout, scrollShift(11, 1, layout)).x).toBe(57);
  });

  test("the newest bar starts one pitch further right, off the edge", () => {
    expect(barRect(1, 10, layout, scrollShift(11, 0, layout)).x).toBe(63);
  });

  test("slides in whole pixels", () => {
    for (const progress of [0.1, 0.33, 0.5, 0.71, 0.99]) {
      expect(Number.isInteger(scrollShift(11, progress, layout))).toBe(true);
    }
  });
});
