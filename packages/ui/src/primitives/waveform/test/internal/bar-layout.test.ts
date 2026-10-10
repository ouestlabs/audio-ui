import { describe, expect, test } from "bun:test";
import {
  barCount,
  barLayout,
  barRect,
  barRects,
  bitmapLength,
  envelopeRects,
  mirroredScrollRects,
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

describe("barRects", () => {
  test("gives one rect per level, left to right", () => {
    const layout = {
      barWidth: 4,
      count: 3,
      height: 100,
      minBarHeight: 2,
      pitch: 6,
      variant: "mirror" as const,
      width: 16,
    };
    expect(barRects([0.5, 1], layout, 2).map((rect) => rect.x)).toEqual([2, 8]);
  });
});

describe("mirroredScrollRects", () => {
  // The middle bar starts at (64 - 4) / 2 = 30
  const layout = {
    barWidth: 4,
    count: 10,
    height: 100,
    minBarHeight: 2,
    pitch: 6,
    variant: "mirror" as const,
    width: 64,
  };
  const history = [0.2, 0.4, 0.6, 0.8];

  test("once settled: the newest in the middle, older ones a pitch apart on both sides", () => {
    const rects = mirroredScrollRects(history, 1, layout);
    expect(rects.map((rect) => rect.x)).toEqual([12, 18, 24, 30, 36, 42, 48]);
    expect(rects.map((rect) => rect.height)).toEqual([
      20, 40, 60, 80, 60, 40, 20,
    ]);
  });

  test("as an entry arrives: the middle still shows the one before, which hides behind it", () => {
    const rects = mirroredScrollRects(history, 0, layout);
    expect(rects.at(3)).toMatchObject({ height: 60, x: 30 });
    expect(rects.map((rect) => rect.x)).toEqual([18, 24, 30, 30, 30, 36, 42]);
  });

  test("halfway: the middle grows towards the newest while the others slide out", () => {
    const rects = mirroredScrollRects(history, 0.5, layout);
    expect(rects.at(3)).toMatchObject({ height: 70, x: 30 });
    expect(rects.map((rect) => rect.x)).toEqual([15, 21, 27, 30, 33, 39, 45]);
  });

  test("stops at the edges, and draws nothing without a history", () => {
    const long = new Float32Array(100).fill(0.5);
    const rects = mirroredScrollRects(long, 1, layout);
    expect(Math.min(...rects.map((rect) => rect.x))).toBeGreaterThanOrEqual(-4);
    expect(mirroredScrollRects([], 1, layout)).toEqual([]);
  });
});

describe("envelopeRects", () => {
  const layout = {
    barWidth: 4,
    count: 3,
    height: 100,
    minBarHeight: 2,
    pitch: 6,
    variant: "mirror" as const,
    width: 16,
  };
  const envelope = {
    high: new Float32Array([0.8, 0.5, 0]),
    low: new Float32Array([-0.2, -0.5, 0]),
  };

  test("runs each bar from its high to its low around the middle", () => {
    const [lopsided, even] = envelopeRects(envelope, layout);
    expect(lopsided).toEqual({ height: 50, width: 4, x: 0, y: 10 });
    expect(even).toEqual({ height: 50, width: 4, x: 6, y: 25 });
  });

  test("silence still draws a sliver around the middle", () => {
    expect(envelopeRects(envelope, layout).at(2)).toEqual({
      height: 2,
      width: 4,
      x: 12,
      y: 49,
    });
  });

  test("bars stand on the baseline, as tall as they reach either way", () => {
    const [lopsided] = envelopeRects(envelope, { ...layout, variant: "bars" });
    expect(lopsided).toMatchObject({ height: 80, y: 20 });
  });
});
